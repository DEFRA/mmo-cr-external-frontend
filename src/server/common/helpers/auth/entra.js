import { config } from '#/config/config.js'

const MOCK_ALLOWED_ENVIRONMENTS = ['local', 'dev', 'test']
const CHALLENGE_TYPES = 'oob password redirect'
const SCOPES = 'openid offline_access'
const PENDING_SIGN_IN_SESSION_KEY = 'entraPendingSignIn'
const REQUEST_TIMEOUT_MS = 10000
const CLOCK_SKEW_SECONDS = 300
const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SUBDOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*$/i

/** Outcomes the sign-in screens react to; every other failure is `unavailable`. */
export const signInFailure = {
  invalidCredentials: 'invalid_credentials',
  invalidCode: 'invalid_code',
  expired: 'expired',
  unsupported: 'unsupported',
  unavailable: 'unavailable'
}

export class EntraSignInError extends Error {
  constructor(reason, detail) {
    super(`Entra sign-in failed: ${reason}`)
    this.name = 'EntraSignInError'
    this.reason = reason
    this.errorCode = detail?.error
    this.subError = detail?.suberror
  }
}

export function isEntraMode() {
  return config.get('authentication.mode') === 'entra'
}

function entraSettings() {
  return config.get('authentication.entra')
}

/**
 * Fails server start-up on unsafe or incomplete authentication configuration,
 * so a misconfigured deployment never runs with broken or simulated sign-in.
 */
export function assertAuthenticationConfiguration() {
  if (!isEntraMode()) {
    const environment = config.get('catchRecording.environment')
    if (!MOCK_ALLOWED_ENVIRONMENTS.includes(environment)) {
      throw new Error(
        `Mock authentication is not permitted in the ${environment} environment`
      )
    }
    return
  }

  const { tenantSubdomain, clientId } = entraSettings()
  const missing = Object.entries({
    ENTRA_TENANT_SUBDOMAIN: tenantSubdomain,
    ENTRA_CLIENT_ID: clientId
  })
    .filter(([, value]) => !value)
    .map(([name]) => name)

  if (missing.length) {
    throw new Error(`Entra authentication is missing: ${missing.join(', ')}`)
  }

  if (!SUBDOMAIN_PATTERN.test(tenantSubdomain)) {
    throw new Error('ENTRA_TENANT_SUBDOMAIN is invalid')
  }

  if (!GUID_PATTERN.test(clientId)) {
    throw new Error('ENTRA_CLIENT_ID must be a GUID')
  }
}

function endpoint(path) {
  const { tenantSubdomain } = entraSettings()
  return `https://${tenantSubdomain}.ciamlogin.com/${tenantSubdomain}.onmicrosoft.com/oauth2/v2.0/${path}`
}

async function post(path, fields) {
  let response
  try {
    response = await fetch(endpoint(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: new URLSearchParams({
        client_id: entraSettings().clientId,
        ...fields
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch {
    throw new EntraSignInError(signInFailure.unavailable)
  }

  const body = await response.json().catch(() => null)

  if (body?.challenge_type === 'redirect') {
    throw new EntraSignInError(signInFailure.unsupported, body)
  }

  if (response.ok && body) {
    return body
  }

  throw new EntraSignInError(classifyError(body), body)
}

function classifyError(body) {
  if (body?.error === 'expired_token') {
    return signInFailure.expired
  }
  // Both mean "wrong email or password"; kept identical to avoid revealing which accounts exist.
  if (
    body?.error === 'user_not_found' ||
    (body?.error === 'invalid_grant' && !body.suberror)
  ) {
    return signInFailure.invalidCredentials
  }
  if (body?.suberror === 'invalid_oob_value') {
    return signInFailure.invalidCode
  }
  if (['mfa_required', 'registration_required'].includes(body?.suberror)) {
    return signInFailure.unsupported
  }
  return signInFailure.unavailable
}

function decodeJwtPayload(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
  } catch {
    return null
  }
}

// The ID token comes straight from Entra's token endpoint over TLS, so its claims are checked rather than its signature.
function accountFromTokenResponse(tokens) {
  const claims = decodeJwtPayload(tokens?.id_token)
  const nowSeconds = Math.floor(Date.now() / 1000)
  const audience = Array.isArray(claims?.aud) ? claims.aud : [claims?.aud]

  if (
    !claims ||
    !audience.includes(entraSettings().clientId) ||
    typeof claims.exp !== 'number' ||
    claims.exp + CLOCK_SKEW_SECONDS < nowSeconds
  ) {
    throw new EntraSignInError(signInFailure.unavailable, {
      error: 'invalid_id_token'
    })
  }

  const email = claims.email ?? claims.preferred_username
  if (!email) {
    throw new EntraSignInError(signInFailure.unavailable, {
      error: 'missing_account'
    })
  }

  return { email, name: claims.name ?? null }
}

/**
 * Signs in with email and password. Returns the account, or
 * `{ codeRequired: true }` when Entra has emailed a one-time code instead.
 */
export async function signInWithPassword(request, email, password) {
  discardPendingSignIn(request)

  const started = await post('initiate', {
    username: email,
    challenge_type: CHALLENGE_TYPES
  })
  const challenge = await post('challenge', {
    continuation_token: started.continuation_token,
    challenge_type: CHALLENGE_TYPES
  })

  if (challenge.challenge_type === 'oob') {
    request.yar.set(PENDING_SIGN_IN_SESSION_KEY, {
      continuationToken: challenge.continuation_token,
      codeLength: challenge.code_length ?? null,
      sentTo: challenge.challenge_target_label ?? null
    })
    return { codeRequired: true }
  }

  if (challenge.challenge_type !== 'password') {
    throw new EntraSignInError(signInFailure.unsupported, {
      error: 'unexpected_challenge'
    })
  }

  const tokens = await post('token', {
    continuation_token: challenge.continuation_token,
    grant_type: 'password',
    password,
    scope: SCOPES
  })

  return { account: accountFromTokenResponse(tokens) }
}

export function getPendingSignIn(request) {
  return request.yar.get(PENDING_SIGN_IN_SESSION_KEY)
}

export function discardPendingSignIn(request) {
  request.yar.clear(PENDING_SIGN_IN_SESSION_KEY)
}

/** Completes a sign-in that needed an emailed one-time code. */
export async function submitSignInCode(request, code) {
  const pending = getPendingSignIn(request)
  if (!pending?.continuationToken) {
    throw new EntraSignInError(signInFailure.expired)
  }

  try {
    const tokens = await post('token', {
      continuation_token: pending.continuationToken,
      grant_type: 'oob',
      oob: code,
      scope: SCOPES
    })
    discardPendingSignIn(request)
    return { account: accountFromTokenResponse(tokens) }
  } catch (error) {
    // A wrong code can be retried with the same continuation token; anything else ends the attempt.
    if (error.reason !== signInFailure.invalidCode) {
      discardPendingSignIn(request)
    }
    throw error
  }
}
