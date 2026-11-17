import { config } from '#/config/config.js'
import { assertAuthenticationConfiguration, getAccessToken } from './entra.js'

describe('#assertAuthenticationConfiguration', () => {
  let originalAuthentication
  let originalEnvironment

  beforeEach(() => {
    originalAuthentication = config.get('authentication')
    originalEnvironment = config.get('catchRecording.environment')
  })

  afterEach(() => {
    config.set('authentication', originalAuthentication)
    config.set('catchRecording.environment', originalEnvironment)
  })

  function useEntra(overrides = {}) {
    config.set('authentication', {
      mode: 'entra',
      entra: {
        tenantSubdomain: 'external-tenant',
        clientId: '00000000-0000-4000-8000-000000000001',
        ...overrides
      }
    })
  }

  test.each(['local', 'dev', 'test'])(
    'Should allow mock authentication in the %s environment',
    (environment) => {
      config.set('catchRecording.environment', environment)

      expect(() => assertAuthenticationConfiguration()).not.toThrow()
    }
  )

  test.each(['prod', 'perf-test', 'ext-test'])(
    'Should refuse mock authentication in the %s environment',
    (environment) => {
      config.set('catchRecording.environment', environment)

      expect(() => assertAuthenticationConfiguration()).toThrow(
        'Mock authentication is not permitted'
      )
    }
  )

  test('Should accept a tenant subdomain and client ID, with no client secret', () => {
    useEntra()

    expect(() => assertAuthenticationConfiguration()).not.toThrow()
  })

  test('Should name every missing Entra setting', () => {
    useEntra({ tenantSubdomain: null, clientId: null })

    expect(() => assertAuthenticationConfiguration()).toThrow(
      'ENTRA_TENANT_SUBDOMAIN, ENTRA_CLIENT_ID'
    )
  })

  test('Should reject a client ID that is not a GUID', () => {
    useEntra({ clientId: 'not-a-guid' })

    expect(() => assertAuthenticationConfiguration()).toThrow(
      'ENTRA_CLIENT_ID must be a GUID'
    )
  })

  test.each(['evil.example/', 'tenant.ciamlogin.com', '-tenant'])(
    'Should reject the unsafe tenant subdomain %s',
    (tenantSubdomain) => {
      useEntra({ tenantSubdomain })

      expect(() => assertAuthenticationConfiguration()).toThrow(
        'ENTRA_TENANT_SUBDOMAIN is invalid'
      )
    }
  )

  test('Should reject a tenant ID that is not a GUID', () => {
    useEntra({ tenantId: 'EXTIDMMOExternalTenantDev' })

    expect(() => assertAuthenticationConfiguration()).toThrow(
      'ENTRA_TENANT_ID must be a GUID'
    )
  })

  test('Should accept browser fallback URLs on the same origin', () => {
    useEntra({
      redirectUri: 'https://frontend.test/auth/callback',
      postLogoutRedirectUri: 'https://frontend.test/signed-out'
    })

    expect(() => assertAuthenticationConfiguration()).not.toThrow()
  })

  test.each([
    ['the site root', 'https://frontend.test/'],
    ['a query string', 'https://frontend.test/auth/callback?x=1'],
    ['a non-http scheme', 'javascript:alert(1)']
  ])('Should reject a redirect URI with %s', (_, redirectUri) => {
    useEntra({ redirectUri })

    expect(() => assertAuthenticationConfiguration()).toThrow(
      'ENTRA_REDIRECT_URI'
    )
  })

  test('Should reject a post-logout URI without a redirect URI', () => {
    useEntra({ postLogoutRedirectUri: 'https://frontend.test/signed-out' })

    expect(() => assertAuthenticationConfiguration()).toThrow(
      'requires ENTRA_REDIRECT_URI'
    )
  })

  test('Should reject redirect URIs on different origins', () => {
    useEntra({
      redirectUri: 'https://frontend.test/auth/callback',
      postLogoutRedirectUri: 'https://other.test/signed-out'
    })

    expect(() => assertAuthenticationConfiguration()).toThrow('same origin')
  })
})

describe('#getAccessToken', () => {
  const ENTRA_TOKEN_URL =
    'https://external-tenant.ciamlogin.com/external-tenant.onmicrosoft.com/oauth2/v2.0/token'
  let originalAuthentication
  let originalFetch

  function fakeRequest(apiTokens) {
    const store = { entraApiTokens: apiTokens }
    return {
      yar: {
        get: (key) => store[key] ?? null,
        set: (key, value) => {
          store[key] = value
        },
        clear: (key) => {
          delete store[key]
        }
      },
      stored: () => store.entraApiTokens
    }
  }

  beforeEach(() => {
    originalAuthentication = config.get('authentication')
    originalFetch = globalThis.fetch
    config.set('authentication', {
      mode: 'entra',
      entra: {
        tenantSubdomain: 'external-tenant',
        clientId: '00000000-0000-4000-8000-000000000001',
        apiScopes: 'api://catch-recording/access_as_user'
      }
    })
  })

  afterEach(() => {
    config.set('authentication', originalAuthentication)
    globalThis.fetch = originalFetch
  })

  test('Returns the stored access token while it is still valid', async () => {
    globalThis.fetch = vi.fn()
    const request = fakeRequest({
      accessToken: 'current-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() + 10 * 60 * 1000
    })

    expect(await getAccessToken(request)).toBe('current-token')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  test('Refreshes an expiring access token and keeps the new tokens server-side', async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({
        access_token: 'new-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600
      })
    )
    const request = fakeRequest({
      accessToken: 'old-token',
      refreshToken: 'refresh-token',
      expiresAt: Date.now() + 10 * 1000
    })

    expect(await getAccessToken(request)).toBe('new-token')
    const [url, init] = globalThis.fetch.mock.calls[0]
    expect(url).toBe(ENTRA_TOKEN_URL)
    expect(Object.fromEntries(new URLSearchParams(init.body))).toMatchObject({
      grant_type: 'refresh_token',
      refresh_token: 'refresh-token',
      scope: 'openid offline_access api://catch-recording/access_as_user'
    })
    expect(request.stored()).toMatchObject({
      accessToken: 'new-token',
      refreshToken: 'new-refresh-token'
    })
  })

  test('Drops the tokens and returns null when refresh fails', async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({ error: 'invalid_grant' }, { status: 400 })
    )
    const request = fakeRequest({
      accessToken: 'old-token',
      refreshToken: 'revoked-refresh-token',
      expiresAt: 0
    })

    expect(await getAccessToken(request)).toBeNull()
    expect(request.stored()).toBeUndefined()
  })

  test('Returns null when no backend API scopes are configured', async () => {
    config.set('authentication.entra.apiScopes', null)

    expect(
      await getAccessToken(
        fakeRequest({ accessToken: 'token', expiresAt: Date.now() + 3600000 })
      )
    ).toBeNull()
  })
})
