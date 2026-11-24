import { createHash, randomBytes } from 'node:crypto'

import {
  apiScopes,
  authorityBase,
  entraSettings,
  isBrowserFallbackEnabled,
  tokenScope
} from './entra-config.js'
import {
  EntraSignInError,
  entraLogger as logger,
  post,
  signInFailure
} from './entra-client.js'

export {
  CALLBACK_PATH,
  SIGNED_OUT_PATH,
  assertAuthenticationConfiguration,
  isBrowserFallbackEnabled,
  isEntraMode
} from './entra-config.js'
export { EntraSignInError, signInFailure } from './entra-client.js'

const CHALLENGE_TYPES = 'oob password redirect'
const PENDING_SIGN_IN_SESSION_KEY = 'entraPendingSignIn'
const PENDING_BROWSER_SIGN_IN_SESSION_KEY = 'entraPendingBrowserSignIn'
const API_TOKENS_SESSION_KEY = 'entraApiTokens'
const MAX_CODE_ATTEMPTS = 5
const BROWSER_SIGN_IN_MAX_AGE_MS = 10 * 60 * 1000
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 60 * 1000
const CLOCK_SKEW_SECONDS = 300
const MAX_LOGGED_ERROR_LENGTH = 64
const RANDOM_BYTES = 32

function decodeJwtPayload(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
  } catch {
    return null
  }
}

function idTokenProblem(claims, { nonce }) {
  if (!claims) {
    return 'missing_or_unreadable_id_token'
  }

  const { clientId, tenantId } = entraSettings()
  const nowSeconds = Math.floor(Date.now() / 1000)
  // Checked in order; the first failing check is reported.
  const checks = [
    ['audience_mismatch', ![claims.aud].flat().includes(clientId)],
    ['missing_expiry', typeof claims.exp !== 'number'],
    ['expired', claims.exp + CLOCK_SKEW_SECONDS < nowSeconds],
    ['tenant_mismatch', Boolean(tenantId) && claims.tid !== tenantId],
    ['nonce_mismatch', nonce !== undefined && claims.nonce !== nonce],
    ['missing_user_id', !(claims.oid ?? claims.sub)]
  ]

  return checks.find(([, failed]) => failed)?.[0] ?? null
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
  const verifier = randomBytes(RANDOM_BYTES).toString('base64url')
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
  const state = randomBytes(RANDOM_BYTES).toString('base64url')
  const nonce = randomBytes(RANDOM_BYTES).toString('base64url')

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
      { error: String(query.error).slice(0, MAX_LOGGED_ERROR_LENGTH) }
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
