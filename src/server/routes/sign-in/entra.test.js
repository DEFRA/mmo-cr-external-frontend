import { load } from 'cheerio'
import { config } from '#/config/config.js'
import { createServer } from '#/server/server.js'

const entraMocks = vi.hoisted(() => ({
  constructClient: vi.fn(),
  getAuthCodeUrl: vi.fn(),
  acquireTokenByCode: vi.fn(),
  generatePkceCodes: vi.fn()
}))

vi.mock('@azure/msal-node', () => ({
  ConfidentialClientApplication: vi.fn(function (options) {
    entraMocks.constructClient(options)
    return {
      getAuthCodeUrl: entraMocks.getAuthCodeUrl,
      acquireTokenByCode: entraMocks.acquireTokenByCode
    }
  }),
  CryptoProvider: vi.fn(function () {
    return { generatePkceCodes: entraMocks.generatePkceCodes }
  })
}))

describe('Entra web sign-in', () => {
  let server
  let originalAuthentication

  beforeAll(async () => {
    originalAuthentication = config.get('authentication')
    config.set('authentication', {
      mode: 'entra',
      entra: {
        tenantSubdomain: 'external-tenant',
        clientId: 'web-client-id',
        clientSecret: 'server-only-secret',
        redirectUri: 'http://localhost:3000/auth/callback',
        postLogoutRedirectUri: 'http://localhost:3000/signed-out'
      }
    })
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    config.set('authentication', originalAuthentication)
  })

  beforeEach(() => {
    entraMocks.getAuthCodeUrl.mockReset()
    entraMocks.acquireTokenByCode.mockReset()
    entraMocks.generatePkceCodes.mockReset()
    entraMocks.generatePkceCodes.mockResolvedValue({
      verifier: 'test-verifier',
      challenge: 'test-challenge'
    })
    entraMocks.getAuthCodeUrl.mockImplementation(
      async ({ state }) =>
        `https://external-tenant.ciamlogin.com/authorize?state=${state}`
    )
    entraMocks.acquireTokenByCode.mockResolvedValue({
      account: { username: 'test@example.com', name: 'Test User' }
    })
  })

  test('Shows hosted Entra sign-in instead of collecting passwords locally', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/sign-in'
    })
    const $ = load(result)

    expect(statusCode).toBe(200)
    expect($('form[action="/sign-in"] button').text().trim()).toBe(
      'Continue to sign in'
    )
    expect($('input[type="password"]')).toHaveLength(0)
    expect(result).toContain(
      'Your password is never entered or stored on this website.'
    )
  })

  test('Sends forgotten-password requests to the Entra-hosted recovery flow', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/forgotten-password'
    })

    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toContain(
      'https://external-tenant.ciamlogin.com/'
    )
    expect(entraMocks.getAuthCodeUrl).toHaveBeenCalledTimes(1)
  })

  test('Starts authorization with state and PKCE, then creates a session only after callback exchange', async () => {
    const startResponse = await server.inject({
      method: 'POST',
      url: '/sign-in'
    })
    const cookie = startResponse.headers['set-cookie'][0].split(';')[0]
    const authorizationRequest = entraMocks.getAuthCodeUrl.mock.calls[0][0]
    const state = new URL(startResponse.headers.location).searchParams.get(
      'state'
    )

    expect(startResponse.statusCode).toBe(303)
    expect(authorizationRequest).toMatchObject({
      scopes: ['openid', 'profile', 'email'],
      redirectUri: 'http://localhost:3000/auth/callback',
      state,
      nonce: expect.any(String),
      codeChallenge: 'test-challenge',
      codeChallengeMethod: 'S256'
    })

    const callbackResponse = await server.inject({
      method: 'GET',
      url: `/auth/callback?code=one-time-code&state=${state}`,
      headers: { cookie }
    })

    expect(callbackResponse.statusCode).toBe(303)
    expect(callbackResponse.headers.location).toBe('/records')
    expect(callbackResponse.headers['cache-control']).toBe('no-store')
    expect(callbackResponse.headers['referrer-policy']).toBe('no-referrer')
    expect(entraMocks.acquireTokenByCode).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'one-time-code',
        state,
        nonce: authorizationRequest.nonce,
        codeVerifier: 'test-verifier'
      }),
      expect.objectContaining({ code: 'one-time-code', state })
    )
  })

  test('Rejects an invalid callback state without exchanging the authorization code', async () => {
    const startResponse = await server.inject({
      method: 'POST',
      url: '/sign-in'
    })
    const cookie = startResponse.headers['set-cookie'][0].split(';')[0]
    const callbackResponse = await server.inject({
      method: 'GET',
      url: '/auth/callback?code=one-time-code&state=attacker-state',
      headers: { cookie }
    })

    expect(callbackResponse.statusCode).toBe(303)
    expect(callbackResponse.headers.location).toBe('/sign-in')
    expect(entraMocks.acquireTokenByCode).not.toHaveBeenCalled()

    const signInPage = await server.inject({
      method: 'GET',
      url: '/sign-in',
      headers: {
        cookie:
          callbackResponse.headers['set-cookie'][0]?.split(';')[0] ?? cookie
      }
    })
    expect(signInPage.result).toContain('We could not sign you in. Try again.')
  })

  test('Returns the user to the app with an accessible cancellation message', async () => {
    const startResponse = await server.inject({
      method: 'POST',
      url: '/sign-in'
    })
    const cookie = startResponse.headers['set-cookie'][0].split(';')[0]
    const state = entraMocks.getAuthCodeUrl.mock.calls[0][0].state
    const callbackResponse = await server.inject({
      method: 'GET',
      url: `/auth/callback?error=access_denied&state=${state}`,
      headers: { cookie }
    })
    const signInPage = await server.inject({
      method: 'GET',
      url: '/sign-in',
      headers: {
        cookie: callbackResponse.headers['set-cookie'][0].split(';')[0]
      }
    })

    expect(callbackResponse.headers.location).toBe('/sign-in')
    expect(signInPage.result).toContain(
      'Sign in could not be completed. Try again.'
    )
  })

  test('Clears the local session and redirects through Entra sign-out', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/sign-out'
    })

    expect(response.statusCode).toBe(303)
    const logoutUrl = new URL(response.headers.location)

    expect(logoutUrl.origin).toBe('https://external-tenant.ciamlogin.com')
    expect(logoutUrl.pathname).toBe(
      '/external-tenant.onmicrosoft.com/oauth2/v2.0/logout'
    )
    expect(logoutUrl.searchParams.get('post_logout_redirect_uri')).toBe(
      'http://localhost:3000/signed-out'
    )
  })
})
