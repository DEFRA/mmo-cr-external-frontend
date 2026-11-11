import { randomBytes, timingSafeEqual } from 'node:crypto'

import { ConfidentialClientApplication, CryptoProvider } from '@azure/msal-node'

import { config } from '#/config/config.js'

const authRequestSessionKey = 'entraAuthRequest'
const scopes = ['openid', 'profile', 'email']

let client

function entraSettings() {
  const settings = config.get('authentication.entra')
  const { tenantSubdomain, clientId, clientSecret, redirectUri } = settings

  if (!tenantSubdomain || !clientId || !clientSecret || !redirectUri) {
    throw new Error('Entra web authentication is not fully configured')
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*$/.test(tenantSubdomain)) {
    throw new Error('The Entra tenant subdomain is invalid')
  }

  return settings
}

function getClient() {
  if (!client) {
    const { tenantSubdomain, clientId, clientSecret } = entraSettings()

    client = new ConfidentialClientApplication({
      auth: {
        clientId,
        clientSecret,
        authority: `https://${tenantSubdomain}.ciamlogin.com/`
      },
      system: {
        loggerOptions: {
          loggerCallback() {},
          piiLoggingEnabled: false
        }
      }
    })
  }

  return client
}

function matchesState(expectedState, actualState) {
  if (
    typeof expectedState !== 'string' ||
    typeof actualState !== 'string' ||
    expectedState.length !== actualState.length
  ) {
    return false
  }

  return timingSafeEqual(Buffer.from(expectedState), Buffer.from(actualState))
}

export function assertAuthenticationConfiguration() {
  const mode = config.get('authentication.mode')

  const mockAllowed =
    config.get('isTest') ||
    ['local', 'dev'].includes(config.get('catchRecording.environment'))

  if (mode === 'mock' && (config.get('isProduction') || !mockAllowed)) {
    throw new Error(
      'Mock authentication is restricted to local development and tests'
    )
  }

  if (mode !== 'entra') {
    return
  }

  const settings = entraSettings()
  const { redirectUri, postLogoutRedirectUri } = settings

  if (!postLogoutRedirectUri) {
    throw new Error('The Entra post-logout redirect URL is not configured')
  }

  let callback
  let postLogout

  try {
    callback = new URL(redirectUri)
    postLogout = new URL(postLogoutRedirectUri)
  } catch {
    throw new Error('The Entra redirect URLs must be valid absolute URLs')
  }

  if (
    !['http:', 'https:'].includes(callback.protocol) ||
    !['http:', 'https:'].includes(postLogout.protocol) ||
    callback.username ||
    callback.password ||
    postLogout.username ||
    postLogout.password ||
    callback.search ||
    callback.hash ||
    postLogout.search ||
    postLogout.hash ||
    callback.pathname !== '/auth/callback' ||
    postLogout.pathname !== '/signed-out' ||
    callback.origin !== postLogout.origin ||
    (config.get('isProduction') &&
      (callback.protocol !== 'https:' || postLogout.protocol !== 'https:'))
  ) {
    throw new Error('The Entra redirect URLs are invalid')
  }
}

export async function createEntraAuthorizationUrl(request) {
  const { redirectUri } = entraSettings()
  const cryptoProvider = new CryptoProvider()
  const { verifier, challenge } = await cryptoProvider.generatePkceCodes()
  const state = randomBytes(32).toString('base64url')
  const nonce = randomBytes(32).toString('base64url')

  request.yar.set(authRequestSessionKey, { state, nonce, verifier })

  try {
    return await getClient().getAuthCodeUrl({
      scopes,
      redirectUri,
      responseMode: 'query',
      state,
      nonce,
      codeChallenge: challenge,
      codeChallengeMethod: 'S256'
    })
  } catch (error) {
    request.yar.set(authRequestSessionKey, null)
    throw error
  }
}

export async function completeEntraAuthorization(request, callback) {
  const pendingRequest = consumePendingRequest(request, callback.state)

  if (typeof callback.code !== 'string' || !callback.code) {
    throw new Error('The Entra authorization code is missing')
  }

  const { redirectUri } = entraSettings()
  const result = await getClient().acquireTokenByCode(
    {
      code: callback.code,
      scopes,
      redirectUri,
      state: pendingRequest.state,
      nonce: pendingRequest.nonce,
      codeVerifier: pendingRequest.verifier
    },
    callback
  )

  if (!result?.account?.username) {
    throw new Error('Entra did not return a signed-in account')
  }

  return {
    email: result.account.username,
    name: result.account.name
  }
}

export function validateEntraAuthorizationState(request, state) {
  consumePendingRequest(request, state)
}

export async function createEntraLogoutUrl() {
  const { tenantSubdomain, clientId, postLogoutRedirectUri } = entraSettings()

  if (!postLogoutRedirectUri) {
    throw new Error('The Entra post-logout redirect URL is not configured')
  }

  const logoutUrl = new URL(
    `${tenantSubdomain}.onmicrosoft.com/oauth2/v2.0/logout`,
    `https://${tenantSubdomain}.ciamlogin.com/`
  )
  logoutUrl.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri)
  logoutUrl.searchParams.set('client_id', clientId)

  return logoutUrl.toString()
}

function consumePendingRequest(request, state) {
  const pendingRequest = request.yar.get(authRequestSessionKey)
  request.yar.set(authRequestSessionKey, null)

  if (!pendingRequest || !matchesState(pendingRequest.state, state)) {
    throw new Error('The Entra authorization state is invalid')
  }

  return pendingRequest
}
