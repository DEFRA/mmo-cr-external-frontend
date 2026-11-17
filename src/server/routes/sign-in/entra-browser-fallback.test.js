import { createHash } from 'node:crypto'

import { load } from 'cheerio'

import { config } from '#/config/config.js'
import { createServer } from '#/server/server.js'

const CLIENT_ID = '00000000-0000-4000-8000-000000000001'
const ENTRA_ORIGIN = 'https://external-tenant.ciamlogin.com'
const ENTRA_BASE = `${ENTRA_ORIGIN}/external-tenant.onmicrosoft.com/oauth2/v2.0/`
const REDIRECT_URI = 'http://localhost:3000/auth/callback'
const POST_LOGOUT_URI = 'http://localhost:3000/signed-out'
const API_SCOPE = 'api://catch-recording/access_as_user'
const EMAIL = 'skipper@example.com'

function idToken(claims) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  return [
    encode({ alg: 'RS256', typ: 'JWT' }),
    encode({
      aud: CLIENT_ID,
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: 'user-subject-id',
      ...claims
    }),
    'signature'
  ].join('.')
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

const cookieFrom = (response, fallback) =>
  response.headers['set-cookie']?.[0]?.split(';')[0] ?? fallback

describe('Entra browser fallback', () => {
  let server
  let originalAuthentication
  let originalFetch
  let tokenEndpoint

  beforeAll(async () => {
    originalAuthentication = config.get('authentication')
    config.set('authentication', {
      mode: 'entra',
      entra: {
        tenantSubdomain: 'external-tenant',
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        postLogoutRedirectUri: POST_LOGOUT_URI,
        apiScopes: API_SCOPE
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
    tokenEndpoint = vi.fn()
    const endpoints = {
      initiate: () => json(200, { continuation_token: 'ct-initiate' }),
      // MFA (or any step our form cannot complete) makes Entra ask for the browser.
      challenge: () => json(200, { challenge_type: 'redirect' }),
      token: (body) => tokenEndpoint(body)
    }
    originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async (url, init) => {
      const target = String(url)
      if (!target.startsWith(ENTRA_BASE)) {
        return originalFetch(url, init)
      }
      const body = Object.fromEntries(new URLSearchParams(init.body))
      return endpoints[target.slice(ENTRA_BASE.length)](body)
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  async function startFallback() {
    const response = await server.inject({
      method: 'POST',
      url: '/sign-in',
      payload: { email: EMAIL, password: 'a password' }
    })
    const authorizeUrl = new URL(response.headers.location)
    return {
      response,
      authorizeUrl,
      params: authorizeUrl.searchParams,
      cookie: cookieFrom(response)
    }
  }

  function callback(cookie, query) {
    return server.inject({
      method: 'GET',
      url: `/auth/callback?${new URLSearchParams(query)}`,
      headers: { cookie }
    })
  }

  test('Hands off to Entra in the browser with PKCE, state, nonce and no secret', async () => {
    const { response, authorizeUrl, params } = await startFallback()

    expect(response.statusCode).toBe(303)
    expect(`${authorizeUrl.origin}${authorizeUrl.pathname}`).toBe(
      `${ENTRA_BASE}authorize`
    )
    expect(Object.fromEntries(params)).toMatchObject({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      response_mode: 'query',
      scope: `openid offline_access ${API_SCOPE}`,
      code_challenge_method: 'S256',
      login_hint: EMAIL
    })
    expect(params.get('state')).toMatch(/^[\w-]{43}$/)
    expect(params.get('nonce')).toMatch(/^[\w-]{43}$/)
    expect(params.get('code_challenge')).toMatch(/^[\w-]{43}$/)
    expect(params.has('client_secret')).toBe(false)
  })

  test('Completes sign-in on callback, sending the matching PKCE verifier', async () => {
    const { params, cookie } = await startFallback()
    tokenEndpoint.mockImplementation(() =>
      json(200, {
        id_token: idToken({ nonce: params.get('nonce') }),
        access_token: 'api-access-token',
        refresh_token: 'api-refresh-token',
        expires_in: 3600
      })
    )

    const response = await callback(cookie, {
      code: 'one-time-code',
      state: params.get('state')
    })
    const tokenRequest = tokenEndpoint.mock.calls[0][0]

    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toBe('/records')
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['referrer-policy']).toBe('no-referrer')
    expect(tokenRequest).toMatchObject({
      client_id: CLIENT_ID,
      grant_type: 'authorization_code',
      code: 'one-time-code',
      redirect_uri: REDIRECT_URI
    })
    expect(tokenRequest).not.toHaveProperty('client_secret')
    expect(
      createHash('sha256')
        .update(tokenRequest.code_verifier)
        .digest('base64url')
    ).toBe(params.get('code_challenge'))

    const page = await server.inject({
      method: 'GET',
      url: '/not-implemented',
      headers: { cookie: cookieFrom(response, cookie) }
    })
    expect(page.statusCode).toBe(200)
  })

  test.each([
    ['a forged state', (params) => ({ code: 'c', state: 'forged' })],
    ['a missing state', () => ({ code: 'c' })]
  ])(
    'Rejects a callback with %s without redeeming the code',
    async (_, query) => {
      const { params, cookie } = await startFallback()
      const response = await callback(cookie, query(params))

      expect(response.headers.location).toBe('/sign-in')
      expect(tokenEndpoint).not.toHaveBeenCalled()
    }
  )

  test('Rejects an ID token whose nonce does not match', async () => {
    const { params, cookie } = await startFallback()
    tokenEndpoint.mockImplementation(() =>
      json(200, { id_token: idToken({ nonce: 'replayed-nonce' }) })
    )

    const response = await callback(cookie, {
      code: 'one-time-code',
      state: params.get('state')
    })
    const page = await server.inject({
      method: 'GET',
      url: '/not-implemented',
      headers: { cookie: cookieFrom(response, cookie) }
    })

    expect(response.headers.location).toBe('/sign-in')
    expect(page.headers.location).toBe('/sign-in')
  })

  test('Rejects a replayed callback once the pending sign-in has been used', async () => {
    const { params, cookie } = await startFallback()
    tokenEndpoint.mockImplementation(() =>
      json(200, { id_token: idToken({ nonce: params.get('nonce') }) })
    )
    const query = { code: 'one-time-code', state: params.get('state') }
    await callback(cookie, query)

    const replay = await callback(cookie, query)

    expect(replay.headers.location).toBe('/sign-in')
    expect(tokenEndpoint).toHaveBeenCalledTimes(1)
  })

  test('Explains when the user cancels on the Entra page', async () => {
    const { params, cookie } = await startFallback()
    const response = await callback(cookie, {
      error: 'access_denied',
      state: params.get('state')
    })
    const signInPage = await server.inject({
      method: 'GET',
      url: '/sign-in',
      headers: { cookie: cookieFrom(response, cookie) }
    })

    expect(response.headers.location).toBe('/sign-in')
    expect(load(signInPage.result)('.govuk-error-summary').text()).toContain(
      'Sign in was cancelled'
    )
  })

  test('Ends the Entra browser session on sign-out after a browser sign-in', async () => {
    const { params, cookie } = await startFallback()
    tokenEndpoint.mockImplementation(() =>
      json(200, { id_token: idToken({ nonce: params.get('nonce') }) })
    )
    const signedIn = await callback(cookie, {
      code: 'one-time-code',
      state: params.get('state')
    })

    const signOut = await server.inject({
      method: 'POST',
      url: '/sign-out',
      headers: { cookie: cookieFrom(signedIn, cookie) }
    })
    const logoutUrl = new URL(signOut.headers.location)

    expect(signOut.statusCode).toBe(303)
    expect(`${logoutUrl.origin}${logoutUrl.pathname}`).toBe(
      `${ENTRA_BASE}logout`
    )
    expect(logoutUrl.searchParams.get('post_logout_redirect_uri')).toBe(
      POST_LOGOUT_URI
    )
  })
})
