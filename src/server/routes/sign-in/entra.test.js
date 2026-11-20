import { load } from 'cheerio'

import { config } from '#/config/config.js'
import { createServer } from '#/server/server.js'

const CLIENT_ID = '00000000-0000-4000-8000-000000000001'
const ENTRA_BASE =
  'https://external-tenant.ciamlogin.com/external-tenant.onmicrosoft.com/oauth2/v2.0/'
const EMAIL = 'skipper@example.com'
const PASSWORD = 'correct horse battery staple'
const TENANT_ID = '00000000-0000-4000-8000-0000000000aa'
const OTHER_TENANT_ID = '00000000-0000-4000-8000-0000000000bb'

function idToken(claimOverrides = {}) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  // Mirrors a real External ID token: no email, name or preferred_username claims.
  return [
    encode({ alg: 'RS256', typ: 'JWT' }),
    encode({
      aud: CLIENT_ID,
      iss: 'https://tenant-id.ciamlogin.com/tenant-id/v2.0',
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: 'user-subject-id',
      tid: 'tenant-id',
      ver: '2.0',
      ...claimOverrides
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

describe('Entra native sign-in', () => {
  let server
  let originalAuthentication
  let originalFetch
  let entra

  beforeAll(async () => {
    originalAuthentication = config.get('authentication')
    config.set('authentication', {
      mode: 'entra',
      entra: { tenantSubdomain: 'external-tenant', clientId: CLIENT_ID }
    })
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    config.set('authentication', originalAuthentication)
  })

  beforeEach(() => {
    entra = {
      initiate: vi.fn(() => json(200, { continuation_token: 'ct-initiate' })),
      challenge: vi.fn(() =>
        json(200, {
          continuation_token: 'ct-challenge',
          challenge_type: 'password'
        })
      ),
      token: vi.fn(() =>
        json(200, { token_type: 'Bearer', id_token: idToken() })
      )
    }
    originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async (url, init) => {
      const target = String(url)
      if (!target.startsWith(ENTRA_BASE)) {
        return originalFetch(url, init)
      }
      const body = Object.fromEntries(new URLSearchParams(init.body))
      return entra[target.slice(ENTRA_BASE.length)](body)
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  const entraCalls = () =>
    globalThis.fetch.mock.calls
      .filter(([url]) => String(url).startsWith(ENTRA_BASE))
      .map(([url, init]) => ({
        endpoint: String(url).slice(ENTRA_BASE.length),
        body: Object.fromEntries(new URLSearchParams(init.body))
      }))

  function submitSignIn(payload = { email: EMAIL, password: PASSWORD }) {
    return server.inject({ method: 'POST', url: '/sign-in', payload })
  }

  async function protectedPage(cookie) {
    return server.inject({
      method: 'GET',
      url: '/not-implemented',
      headers: cookie ? { cookie } : {}
    })
  }

  test('Keeps the existing email and password sign-in form', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/sign-in'
    })
    const $ = load(result)

    expect(statusCode).toBe(200)
    expect($('input#email').attr('type')).toBe('email')
    expect($('input#password').attr('type')).toBe('password')
    expect($('form button').text().trim()).toBe('Sign in')
  })

  test('Successful sign-in calls Entra as a public client and opens protected routes', async () => {
    const response = await submitSignIn()
    const cookie = cookieFrom(response)

    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toBe('/records')
    expect(entraCalls()).toEqual([
      {
        endpoint: 'initiate',
        body: {
          client_id: CLIENT_ID,
          username: EMAIL,
          challenge_type: 'oob password redirect'
        }
      },
      {
        endpoint: 'challenge',
        body: {
          client_id: CLIENT_ID,
          continuation_token: 'ct-initiate',
          challenge_type: 'oob password redirect'
        }
      },
      {
        endpoint: 'token',
        body: {
          client_id: CLIENT_ID,
          continuation_token: 'ct-challenge',
          grant_type: 'password',
          password: PASSWORD,
          scope: 'openid'
        }
      }
    ])
    expect((await protectedPage(cookie)).statusCode).toBe(200)
  })

  test('Sets an HttpOnly, SameSite=Lax session cookie on sign-in', async () => {
    const setCookie = (await submitSignIn()).headers['set-cookie'][0]

    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')
  })

  test('Shows field errors and does not call Entra when fields are empty', async () => {
    const response = await submitSignIn({ email: '  ', password: '' })
    const $ = load(response.result)

    expect(response.statusCode).toBe(400)
    expect($('#email-error').text()).toContain('Enter your email address')
    expect($('#password-error').text()).toContain('Enter your password')
    expect(entraCalls()).toHaveLength(0)
  })

  test.each([
    [
      'a wrong password',
      'token',
      { error: 'invalid_grant', error_codes: [50126] }
    ],
    ['an unknown email address', 'initiate', { error: 'user_not_found' }]
  ])(
    'Failed sign-in with %s shows the same generic error',
    async (_, endpoint, errorBody) => {
      entra[endpoint].mockImplementation(() => json(400, errorBody))
      const response = await submitSignIn()
      const $ = load(response.result)

      expect(response.statusCode).toBe(400)
      expect($('.govuk-error-summary').text()).toContain(
        'The email address or password you entered is incorrect'
      )
      expect($('input#email').attr('value')).toBe(EMAIL)
      expect(response.result).not.toContain(PASSWORD)
      expect((await protectedPage(cookieFrom(response))).headers.location).toBe(
        '/sign-in'
      )
    }
  )

  test.each([
    ['Entra asks for a browser redirect', 'challenge', 200],
    ['MFA is required', 'token', 400]
  ])(
    'Explains when sign-in is not supported because %s',
    async (_, endpoint, status) => {
      entra[endpoint].mockImplementation(() =>
        json(
          status,
          status === 200
            ? { challenge_type: 'redirect' }
            : { error: 'invalid_grant', suberror: 'mfa_required' }
        )
      )
      const response = await submitSignIn()

      expect(response.statusCode).toBe(400)
      expect(load(response.result)('.govuk-error-summary').text()).toContain(
        'You cannot sign in to this service with this account'
      )
    }
  )

  test('Shows a temporary error when Entra cannot be reached', async () => {
    entra.initiate.mockImplementation(() => {
      throw new TypeError('fetch failed')
    })
    const response = await submitSignIn()

    expect(response.statusCode).toBe(503)
    expect(load(response.result)('.govuk-error-summary').text()).toContain(
      'Sign in is temporarily unavailable'
    )
  })

  test('Rejects an ID token issued for a different application', async () => {
    entra.token.mockImplementation(() =>
      json(200, { id_token: idToken({ aud: 'another-app' }) })
    )
    const response = await submitSignIn()

    expect(response.statusCode).toBe(503)
    expect((await protectedPage(cookieFrom(response))).headers.location).toBe(
      '/sign-in'
    )
  })

  test('Rejects an ID token from another tenant when the tenant ID is configured', async () => {
    config.set('authentication.entra.tenantId', TENANT_ID)
    entra.token.mockImplementation(() =>
      json(200, { id_token: idToken({ tid: OTHER_TENANT_ID }) })
    )

    try {
      expect((await submitSignIn()).statusCode).toBe(503)
    } finally {
      config.set('authentication.entra.tenantId', null)
    }
  })

  test('Locks sign-in for an email address after repeated wrong passwords', async () => {
    const email = 'brute-force-target@example.com'
    entra.token.mockImplementation(() =>
      json(400, { error: 'invalid_grant', error_codes: [50126] })
    )

    for (let attempt = 0; attempt < 10; attempt++) {
      expect(
        (await submitSignIn({ email, password: 'guess' })).statusCode
      ).toBe(400)
    }
    const callsBeforeLock = entraCalls().length
    const locked = await submitSignIn({ email, password: PASSWORD })

    expect(locked.statusCode).toBe(429)
    expect(load(locked.result)('.govuk-error-summary').text()).toContain(
      'You have tried to sign in too many times'
    )
    expect(entraCalls()).toHaveLength(callsBeforeLock)
  })

  describe('One-time email code', () => {
    beforeEach(() => {
      entra.challenge.mockImplementation(() =>
        json(200, {
          continuation_token: 'ct-oob',
          challenge_type: 'oob',
          challenge_target_label: 's***r@ex*****.com',
          code_length: 8
        })
      )
    })

    async function startCodeSignIn() {
      const response = await submitSignIn()
      return { response, cookie: cookieFrom(response) }
    }

    function submitCode(cookie, code) {
      return server.inject({
        method: 'POST',
        url: '/sign-in/code',
        payload: { code },
        headers: { cookie }
      })
    }

    test('Asks for the emailed code, then signs in when it is correct', async () => {
      const { response, cookie } = await startCodeSignIn()
      expect(response.headers.location).toBe('/sign-in/code')

      const page = await server.inject({
        method: 'GET',
        url: '/sign-in/code',
        headers: { cookie }
      })
      expect(page.statusCode).toBe(200)
      expect(page.result).toContain('s***r@ex*****.com')

      const submitted = await submitCode(cookie, '1234 5678')

      expect(submitted.headers.location).toBe('/records')
      expect(entraCalls().at(-1)).toEqual({
        endpoint: 'token',
        body: {
          client_id: CLIENT_ID,
          continuation_token: 'ct-oob',
          grant_type: 'oob',
          oob: '12345678',
          scope: 'openid'
        }
      })
      expect(
        (await protectedPage(cookieFrom(submitted, cookie))).statusCode
      ).toBe(200)
    })

    test('Lets the user retry a wrong code', async () => {
      entra.token.mockImplementationOnce(() =>
        json(400, { error: 'invalid_grant', suberror: 'invalid_oob_value' })
      )
      const { cookie } = await startCodeSignIn()

      const wrong = await submitCode(cookie, '00000000')
      expect(wrong.statusCode).toBe(400)
      expect(load(wrong.result)('#code-error').text()).toContain(
        'The code you entered is incorrect'
      )

      const retry = await submitCode(cookieFrom(wrong, cookie), '12345678')
      expect(retry.headers.location).toBe('/records')
    })

    test('Returns to sign in when the code attempt has timed out', async () => {
      entra.token.mockImplementation(() =>
        json(400, { error: 'expired_token' })
      )
      const { cookie } = await startCodeSignIn()
      const expired = await submitCode(cookie, '12345678')
      const signInPage = await server.inject({
        method: 'GET',
        url: '/sign-in',
        headers: { cookie: cookieFrom(expired, cookie) }
      })

      expect(expired.headers.location).toBe('/sign-in')
      expect(signInPage.result).toContain('Your sign in attempt has timed out')
    })

    test('Sends the user to sign in when no code is pending', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/sign-in/code'
      })

      expect(response.headers.location).toBe('/sign-in')
    })

    test('Sends a new code when asked', async () => {
      const { cookie } = await startCodeSignIn()
      entra.challenge.mockImplementation(() =>
        json(200, {
          continuation_token: 'ct-oob-2',
          challenge_type: 'oob',
          code_length: 8
        })
      )

      const resent = await server.inject({
        method: 'POST',
        url: '/sign-in/code/resend',
        headers: { cookie }
      })
      const resentCookie = cookieFrom(resent, cookie)

      expect(resent.statusCode).toBe(200)
      expect(resent.result).toContain('We have sent you a new code.')
      expect(entraCalls().at(-1)).toMatchObject({
        endpoint: 'challenge',
        body: { continuation_token: 'ct-oob' }
      })

      await submitCode(resentCookie, '12345678')
      expect(entraCalls().at(-1).body.continuation_token).toBe('ct-oob-2')
    })

    test('Ends the attempt after too many wrong codes', async () => {
      entra.token.mockImplementation(() =>
        json(400, { error: 'invalid_grant', suberror: 'invalid_oob_value' })
      )
      let { cookie } = await startCodeSignIn()

      for (let attempt = 0; attempt < 5; attempt++) {
        cookie = cookieFrom(await submitCode(cookie, '00000000'), cookie)
      }
      const blocked = await submitCode(cookie, '00000000')
      const signInPage = await server.inject({
        method: 'GET',
        url: '/sign-in',
        headers: { cookie: cookieFrom(blocked, cookie) }
      })

      expect(blocked.headers.location).toBe('/sign-in')
      expect(signInPage.result).toContain(
        'You have entered the wrong code too many times'
      )
      expect(entra.token).toHaveBeenCalledTimes(5)
    })
  })

  test.each([
    '/not-implemented',
    '/records',
    '/account',
    '/trip-date',
    '/about',
    '/select-vessel'
  ])('Redirects unauthenticated requests for %s to sign in', async (url) => {
    const response = await server.inject({ method: 'GET', url })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/sign-in')
  })

  test.each([
    '/',
    '/sign-in',
    '/privacy-notice',
    '/signed-out',
    '/cookies',
    '/health'
  ])('Allows unauthenticated access to public page %s', async (url) => {
    const response = await server.inject({ method: 'GET', url })

    expect(response.statusCode).toBe(200)
  })

  test('Expired sessions are signed out and asked to sign in again', async () => {
    const cookie = cookieFrom(await submitSignIn())
    // The guard reads the lifetime per request; the cache keeps its registered TTL.
    const originalTtl = config.get('session.cache.ttl')
    config.set('session.cache.ttl', 1000)
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 5000)

    try {
      const expired = await protectedPage(cookie)
      const afterCookie = cookieFrom(expired, cookie)
      const signInPage = await server.inject({
        method: 'GET',
        url: '/sign-in',
        headers: { cookie: afterCookie }
      })

      expect(expired.headers.location).toBe('/sign-in')
      expect(signInPage.result).toContain('Your session has expired')
      expect((await protectedPage(afterCookie)).headers.location).toBe(
        '/sign-in'
      )
    } finally {
      clock.mockRestore()
      config.set('session.cache.ttl', originalTtl)
    }
  })

  test('Successful logout clears the session without contacting Entra', async () => {
    const cookie = cookieFrom(await submitSignIn())
    const callsBefore = entraCalls().length
    const signOut = await server.inject({
      method: 'POST',
      url: '/sign-out',
      headers: { cookie }
    })

    expect(signOut.statusCode).toBe(303)
    expect(signOut.headers.location).toBe('/signed-out')
    expect(entraCalls()).toHaveLength(callsBefore)
    expect(
      (await protectedPage(cookieFrom(signOut, cookie))).headers.location
    ).toBe('/sign-in')
  })
})
