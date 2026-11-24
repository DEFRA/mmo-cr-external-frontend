import { config } from '#/config/config.js'

const MOCK_ALLOWED_ENVIRONMENTS = new Set(['local', 'dev', 'test'])
const OIDC_SCOPES = 'openid'
const GUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SUBDOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*$/i

export const CALLBACK_PATH = '/auth/callback'
export const SIGNED_OUT_PATH = '/signed-out'

export function isEntraMode() {
  return config.get('authentication.mode') === 'entra'
}

export function entraSettings() {
  return config.get('authentication.entra')
}

export function isBrowserFallbackEnabled() {
  return Boolean(entraSettings().redirectUri)
}

export function apiScopes() {
  return entraSettings().apiScopes?.trim() || null
}

export function tokenScope() {
  const scopes = apiScopes()
  // offline_access asks for a refresh token, which is only needed to renew API access tokens.
  return scopes ? `${OIDC_SCOPES} offline_access ${scopes}` : OIDC_SCOPES
}

export function authorityBase() {
  const { tenantSubdomain } = entraSettings()
  return `https://${tenantSubdomain}.ciamlogin.com/${tenantSubdomain}.onmicrosoft.com/oauth2/v2.0/`
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

function assertMockAllowed() {
  const environment = config.get('catchRecording.environment')
  if (!MOCK_ALLOWED_ENVIRONMENTS.has(environment)) {
    throw new Error(
      `Mock authentication is not permitted in the ${environment} environment`
    )
  }
}

function assertRequiredSettings({ tenantSubdomain, clientId }) {
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
}

function assertIdentifiers({ tenantSubdomain, clientId, tenantId }) {
  if (!SUBDOMAIN_PATTERN.test(tenantSubdomain)) {
    throw new Error('ENTRA_TENANT_SUBDOMAIN is invalid')
  }

  if (!GUID_PATTERN.test(clientId)) {
    throw new Error('ENTRA_CLIENT_ID must be a GUID')
  }

  if (tenantId && !GUID_PATTERN.test(tenantId)) {
    throw new Error('ENTRA_TENANT_ID must be a GUID')
  }
}

function assertRedirectUris({ redirectUri, postLogoutRedirectUri }) {
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

/**
 * Fails server start-up on unsafe or incomplete authentication configuration,
 * so a misconfigured deployment never runs with broken or simulated sign-in.
 */
export function assertAuthenticationConfiguration() {
  if (!isEntraMode()) {
    assertMockAllowed()
    return
  }

  const settings = entraSettings()
  assertRequiredSettings(settings)
  assertIdentifiers(settings)
  assertRedirectUris(settings)
}
