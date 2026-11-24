import { createHash, randomBytes } from 'node:crypto'

import { config } from '#/config/config.js'
import { createLogger } from '#/server/common/helpers/logging/logger.js'

const logger = createLogger().child({ component: 'entra-auth' })

const MOCK_ALLOWED_ENVIRONMENTS = ['local', 'dev', 'test']
const CHALLENGE_TYPES = 'oob password redirect'
const OIDC_SCOPES = 'openid'
const PENDING_SIGN_IN_SESSION_KEY = 'entraPendingSignIn'
const PENDING_BROWSER_SIGN_IN_SESSION_KEY = 'entraPendingBrowserSignIn'
const API_TOKENS_SESSION_KEY = 'entraApiTokens'
const MAX_CODE_ATTEMPTS = 5
const BROWSER_SIGN_IN_MAX_AGE_MS = 10 * 60 * 1000
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60 * 1000
const REQUEST_TIMEOUT_MS = 10000
const CLOCK_SKEW_SECONDS = 300
const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SUBDOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*$/i

export const CALLBACK_PATH = '/auth/callback'
export const SIGNED_OUT_PATH = '/signed-out'

/** Outcomes the sign-in screens react to; every other failure is `unavailable`. */
export const signInFailure = {
  invalidCredentials: 'invalid_credentials',
  invalidCode: 'invalid_code',
  tooManyCodeAttempts: 'too_many_code_attempts',
  expired: 'expired',
  browserRequired: 'browser_required',
  unsupported: 'unsupported',
  cancelled: 'cancelled',
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

export function isBrowserFallbackEnabled() {
  return Boolean(entraSettings().redirectUri)
}

function apiScopes() {
  return entraSettings().apiScopes?.trim() || null
}

function tokenScope() {
  const scopes = apiScopes()
  // offline_access asks for a refresh token, which is only needed to renew API access tokens.
  return scopes ? `${OIDC_SCOPES} offline_access ${scopes}` : OIDC_SCOPES
}

function assertRegisteredUrl(value, name, expectedPath) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name} must be an absolute URL`)
  }

  const allowedProtocols = config.get('isProduction')
    ? ['https:']
    : ['https:', 'http:']

  if (
    !allowedProtocols.includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== expectedPath
  ) {
    throw new Error(`${name} must be an https URL ending in ${expectedPath}`)
  }

  return url
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

  const {
    tenantSubdomain,
    clientId,
    tenantId,
    redirectUri,
    postLogoutRedirectUri
  } = entraSettings()
  const missing = Object.entries({
    ENTRA_TENANT_SUBDOMAIN: tenantSubdomain,
    ENTRA_CLIENT_ID: clientId,
    ENTRA_API_SCOPES: apiScopes()
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

  if (tenantId && !GUID_PATTERN.test(tenantId)) {
    throw new Error('ENTRA_TENANT_ID must be a GUID')
  }

  const callback = redirectUri
    ? assertRegisteredUrl(redirectUri, 'ENTRA_REDIRECT_URI', CALLBACK_PATH)
    : null
  const postLogout = postLogoutRedirectUri
    ? assertRegisteredUrl(
        postLogoutRedirectUri,
        'ENTRA_POST_LOGOUT_REDIRECT_URI',
        SIGNED_OUT_PATH
      )
    : null

  if (postLogout && !callback) {
    throw new Error(
      'ENTRA_POST_LOGOUT_REDIRECT_URI requires ENTRA_REDIRECT_URI to be set'
    )
  }

  if (callback && postLogout && callback.origin !== postLogout.origin) {
    throw new Error('Entra redirect URIs must share the same origin')
  }
}

function authorityBase() {
  const { tenantSubdomain } = entraSettings()
  return `https://${tenantSubdomain}.ciamlogin.com/${tenantSubdomain}.onmicrosoft.com/oauth2/v2.0/`
}

async function post(path, fields) {
  const step = fields.grant_type ? `${path}:${fields.grant_type}` : path
  const startedAt = Date.now()
  let response
  try {
    response = await fetch(`${authorityBase()}${path}`, {
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
  } catch (error) {
    logger.error(
      {
        entra: {
          step,
          durationMs: Date.now() - startedAt,
          errorName: error?.name,
          causeCode: error?.cause?.code,
          causeMessage: error?.cause?.message ?? error?.message
        }
      },
      `Entra ${step} request failed to reach Entra`
    )
    throw new EntraSignInError(signInFailure.unavailable)
  }

  const body = await response.json().catch(() => null)
  logEntraResponse(step, response, body, Date.now() - startedAt)

  if (body?.challenge_type === 'redirect') {
    throw new EntraSignInError(signInFailure.browserRequired, body)
  }

  if (response.ok && body) {
    return body
  }

  throw new EntraSignInError(classifyError(body), body)
}

// Logs only metadata Entra returns for diagnosis; request bodies, tokens and codes are never logged.
function logEntraResponse(step, response, body, durationMs) {
  const entra = {
    step,
    status: response.status,
    durationMs,
    challengeType: body?.challenge_type,
    redirectReason: body?.redirect_reason,
    codeLength: body?.code_length,
    hasContinuationToken: Boolean(body?.continuation_token),
    hasIdToken: Boolean(body?.id_token),
    hasAccessToken: Boolean(body?.access_token),
    hasRefreshToken: Boolean(body?.refresh_token),
    error: body?.error,
    subError: body?.suberror,
    errorCodes: body?.error_codes,
    errorDescription: body?.error_description?.slice(0, 300),
    traceId: body?.trace_id,
    correlationId: body?.correlation_id,
    contentType: body ? undefined : response.headers.get('content-type')
  }

  if (response.ok && body && body.challenge_type !== 'redirect') {
    logger.info({ entra }, `Entra ${step} succeeded`)
  } else if (body?.error || body?.challenge_type === 'redirect') {
    logger.warn({ entra }, `Entra ${step} returned ${body.error ?? 'redirect'}`)
  } else {
    logger.error({ entra }, `Entra ${step} returned an unexpected response`)
  }
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
    return signInFailure.browserRequired
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

function idTokenProblem(claims, { nonce }) {
  const { clientId, tenantId } = entraSettings()
  const audience = Array.isArray(claims?.aud) ? claims.aud : [claims?.aud]
  const nowSeconds = Math.floor(Date.now() / 1000)

  if (!claims) return 'missing_or_unreadable_id_token'
  if (!audience.includes(clientId)) return 'audience_mismatch'
  if (typeof claims.exp !== 'number') return 'missing_expiry'
  if (claims.exp + CLOCK_SKEW_SECONDS < nowSeconds) return 'expired'
  if (tenantId && claims.tid !== tenantId) return 'tenant_mismatch'
  if (nonce !== undefined && claims.nonce !== nonce) return 'nonce_mismatch'
  if (!(claims.oid ?? claims.sub)) return 'missing_user_id'
  return null
}

// ID tokens come straight from Entra's token endpoint over TLS, so their claims are checked rather than their signature.
function accountFromTokenResponse(tokens, { email, nonce } = {}) {
  const claims = decodeJwtPayload(tokens?.id_token)
  const problem = idTokenProblem(claims, { nonce })

  if (problem) {
    logger.warn(
      {
        entra: {
          step: 'id_token_validation',
          problem,
          expectedAudience: entraSettings().clientId,
          audience: claims?.aud,
          expectedTenantId: entraSettings().tenantId,
          tenantId: claims?.tid,
          issuer: claims?.iss,
          expiresAt: claims?.exp,
          claimNames: claims ? Object.keys(claims) : []
        }
      },
      `Entra ID token rejected: ${problem}`
    )
    throw new EntraSignInError(signInFailure.unavailable, {
      error: 'invalid_id_token',
      suberror: problem
    })
  }

  logger.info(
    {
      entra: {
        step: 'id_token_validation',
        claimNames: Object.keys(claims),
        hasEmailClaim: Boolean(claims.email)
      }
    },
    'Entra ID token accepted'
  )

  // External ID tokens carry no email claim unless configured, so the address the user signed in with is kept.
  return {
    userId: claims.oid ?? claims.sub,
    email: claims.email ?? email ?? claims.preferred_username ?? null,
    name: claims.name ?? null
  }
}

function apiTokensFrom(tokens) {
  if (!apiScopes() || !tokens?.access_token) {
    return null
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiresAt: Date.now() + Number(tokens.expires_in ?? 0) * 1000
  }
}

function signInResult(tokens, identity) {
  return {
    account: accountFromTokenResponse(tokens, identity),
    apiTokens: apiTokensFrom(tokens)
  }
}

export function getPendingSignIn(request) {
  return request.yar.get(PENDING_SIGN_IN_SESSION_KEY)
}

export function discardPendingSignIn(request) {
  request.yar.clear(PENDING_SIGN_IN_SESSION_KEY)
}

function storeCodeChallenge(request, challenge, email) {
  request.yar.set(PENDING_SIGN_IN_SESSION_KEY, {
    continuationToken: challenge.continuation_token,
    codeLength: challenge.code_length ?? null,
    sentTo: challenge.challenge_target_label ?? null,
    email,
    attempts: 0
  })
}

/**
 * Signs in with email and password. Returns `{ account, apiTokens }`, or
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
    storeCodeChallenge(request, challenge, email)
    return { codeRequired: true }
  }

  if (challenge.challenge_type !== 'password') {
    throw new EntraSignInError(signInFailure.browserRequired, {
      error: 'unexpected_challenge'
    })
  }

  const tokens = await post('token', {
    continuation_token: challenge.continuation_token,
    grant_type: 'password',
    password,
    scope: tokenScope()
  })

  return signInResult(tokens, { email })
}

/** Completes a sign-in that needed an emailed one-time code. */
export async function submitSignInCode(request, code) {
  const pending = getPendingSignIn(request)
  if (!pending?.continuationToken) {
    throw new EntraSignInError(signInFailure.expired)
  }

  if (pending.attempts >= MAX_CODE_ATTEMPTS) {
    discardPendingSignIn(request)
    throw new EntraSignInError(signInFailure.tooManyCodeAttempts)
  }

  try {
    const tokens = await post('token', {
      continuation_token: pending.continuationToken,
      grant_type: 'oob',
      oob: code,
      scope: tokenScope()
    })
    discardPendingSignIn(request)
    return signInResult(tokens, { email: pending.email })
  } catch (error) {
    // A wrong code can be retried with the same continuation token; anything else ends the attempt.
    if (error.reason === signInFailure.invalidCode) {
      request.yar.set(PENDING_SIGN_IN_SESSION_KEY, {
        ...pending,
        attempts: pending.attempts + 1
      })
    } else {
      discardPendingSignIn(request)
    }
    throw error
  }
}

/** Asks Entra to email a new one-time code; the previous code stops working. */
export async function resendSignInCode(request) {
  const pending = getPendingSignIn(request)
  if (!pending?.continuationToken) {
    throw new EntraSignInError(signInFailure.expired)
  }

  try {
    const challenge = await post('challenge', {
      continuation_token: pending.continuationToken,
      challenge_type: CHALLENGE_TYPES
    })
    if (challenge.challenge_type !== 'oob') {
      throw new EntraSignInError(signInFailure.browserRequired, {
        error: 'unexpected_challenge'
      })
    }
    storeCodeChallenge(request, challenge, pending.email)
  } catch (error) {
    discardPendingSignIn(request)
    throw error
  }
}

function pkcePair() {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

/**
 * Builds the browser fallback URL for when Entra cannot finish sign-in in our
 * form (for example MFA). Uses the authorization code flow with PKCE as a public client.
 */
export function createBrowserSignInUrl(request, loginHint) {
  if (!isBrowserFallbackEnabled()) {
    throw new EntraSignInError(signInFailure.unsupported, {
      error: 'browser_fallback_disabled'
    })
  }

  const { clientId, redirectUri } = entraSettings()
  const { verifier, challenge } = pkcePair()
  const state = randomBytes(32).toString('base64url')
  const nonce = randomBytes(32).toString('base64url')

  request.yar.set(PENDING_BROWSER_SIGN_IN_SESSION_KEY, {
    state,
    nonce,
    verifier,
    email: loginHint ?? null,
    createdAt: Date.now()
  })

  const url = new URL(`${authorityBase()}authorize`)
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: tokenScope(),
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    ...(loginHint && { login_hint: loginHint })
  }).toString()

  return url.toString()
}

function consumePendingBrowserSignIn(request, state) {
  const pending = request.yar.get(PENDING_BROWSER_SIGN_IN_SESSION_KEY)
  request.yar.clear(PENDING_BROWSER_SIGN_IN_SESSION_KEY)

  if (
    !pending ||
    typeof state !== 'string' ||
    state !== pending.state ||
    Date.now() - pending.createdAt > BROWSER_SIGN_IN_MAX_AGE_MS
  ) {
    throw new EntraSignInError(signInFailure.expired, {
      error: 'invalid_state'
    })
  }

  return pending
}

/** Completes the browser fallback: validates state, then redeems the code with the PKCE verifier. */
export async function completeBrowserSignIn(request, query) {
  const pending = consumePendingBrowserSignIn(request, query.state)

  if (query.error) {
    throw new EntraSignInError(
      query.error === 'access_denied'
        ? signInFailure.cancelled
        : signInFailure.unavailable,
      { error: String(query.error).slice(0, 64) }
    )
  }

  if (typeof query.code !== 'string' || !query.code) {
    throw new EntraSignInError(signInFailure.unavailable, {
      error: 'missing_code'
    })
  }

  const tokens = await post('token', {
    grant_type: 'authorization_code',
    code: query.code,
    redirect_uri: entraSettings().redirectUri,
    code_verifier: pending.verifier,
    scope: tokenScope()
  })

  return signInResult(tokens, { email: pending.email, nonce: pending.nonce })
}

/** Entra sign-out URL for sessions that went through the browser fallback, or null. */
export function createBrowserLogoutUrl() {
  const { clientId, postLogoutRedirectUri } = entraSettings()
  if (!postLogoutRedirectUri) {
    return null
  }

  const url = new URL(`${authorityBase()}logout`)
  url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri)
  url.searchParams.set('client_id', clientId)
  return url.toString()
}

export function storeApiTokens(request, apiTokens) {
  if (apiTokens) {
    request.yar.set(API_TOKENS_SESSION_KEY, apiTokens)
  }
}

/**
 * Returns a valid backend API access token for the signed-in user, refreshing
 * it when close to expiry. Returns null when API scopes are not configured.
 */
export async function getAccessToken(request) {
  const stored = request.yar.get(API_TOKENS_SESSION_KEY)
  if (!apiScopes() || !stored) {
    return null
  }

  if (stored.expiresAt - ACCESS_TOKEN_REFRESH_MARGIN_MS > Date.now()) {
    return stored.accessToken
  }

  if (!stored.refreshToken) {
    return null
  }

  try {
    const tokens = await post('token', {
      grant_type: 'refresh_token',
      refresh_token: stored.refreshToken,
      scope: tokenScope()
    })
    const refreshed = {
      ...apiTokensFrom(tokens),
      refreshToken: tokens.refresh_token ?? stored.refreshToken
    }
    request.yar.set(API_TOKENS_SESSION_KEY, refreshed)
    return refreshed.accessToken
  } catch {
    request.yar.clear(API_TOKENS_SESSION_KEY)
    return null
  }
}
