import { load } from 'cheerio'

import { config } from '#/config/config.js'
import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const CLIENT_ID = '00000000-0000-4000-8000-000000000001'
const RESET_BASE =
  'https://external-tenant.ciamlogin.com/external-tenant.onmicrosoft.com/resetpassword/v1.0/'
const NEW_PASSWORD = 'Correct-Horse-9'

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

const cookieFrom = (response, fallback) =>
  response.headers['set-cookie']?.[0]?.split(';')[0] ?? fallback

let emailCount = 0
const uniqueEmail = () => `skipper${++emailCount}@example.com`

describe('Forgotten password with Entra native authentication', () => {
  let server
  let originalAuthentication
  let originalFetch
  let entra

  beforeAll(async () => {
    originalAuthentication = config.get('authentication')
    config.set('authentication', {
      mode: 'entra',
      entra: {
        tenantSubdomain: 'external-tenant',
        clientId: CLIENT_ID,
        apiScopes: 'api://catch-recording/access_as_user'
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
    entra = {
      start: vi.fn(() => json(200, { continuation_token: 'ct-start' })),
      challenge: vi.fn(() =>
        json(200, {
          continuation_token: 'ct-challenge',
          challenge_type: 'oob',
          code_length: 8
        })
      ),
      continue: vi.fn(() => json(200, { continuation_token: 'ct-verified' })),
      submit: vi.fn(() =>
        json(200, { continuation_token: 'ct-submitted', poll_interval: 0 })
      ),
      poll_completion: vi
        .fn()
        .mockImplementationOnce(() =>
          json(200, { status: 'in_progress', continuation_token: 'ct-poll' })
        )
        .mockImplementation(() => json(200, { status: 'succeeded' }))
    }
    originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async (url, init) => {
      const target = String(url)
      if (!target.startsWith(RESET_BASE)) {
        return originalFetch(url, init)
      }
      const body = Object.fromEntries(new URLSearchParams(init.body))
      return entra[target.slice(RESET_BASE.length)](body)
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  const calls = () =>
    globalThis.fetch.mock.calls
      .filter(([url]) => String(url).startsWith(RESET_BASE))
      .map(([url, init]) => ({
        endpoint: String(url).slice(RESET_BASE.length),
        body: Object.fromEntries(new URLSearchParams(init.body))
      }))

  const inject = (method, url, { cookie, payload } = {}) =>
    server.inject({ method, url, payload, headers: cookie ? { cookie } : {} })

  async function startReset(email = uniqueEmail()) {
    const response = await inject('POST', '/forgotten-password', {
      payload: { email }
    })
    return { response, cookie: cookieFrom(response) }
  }

  async function submitCode(cookie, code = '12345678') {
    const response = await inject('POST', '/forgotten-password/code', {
      cookie,
      payload: { code }
    })
    return { response, cookie: cookieFrom(response, cookie) }
  }

  async function submitPassword(cookie, password = NEW_PASSWORD) {
    const response = await inject('POST', '/forgotten-password/new-password', {
      cookie,
      payload: { password, confirmPassword: password }
    })
    return { response, cookie: cookieFrom(response, cookie) }
  }

  async function followRedirect(response, cookie) {
    return inject('GET', response.headers.location, {
      cookie: cookieFrom(response, cookie)
    })
  }

  test('Resets the password through start, code, new password and completion', async () => {
    const email = uniqueEmail()
    const started = await startReset(email)
    const verified = await submitCode(started.cookie, '1234 5678')
    const saved = await submitPassword(verified.cookie)
    const complete = await followRedirect(saved.response, saved.cookie)

    expect(started.response.headers.location).toBe('/forgotten-password/code')
    expect(verified.response.headers.location).toBe(
      '/forgotten-password/new-password'
    )
    expect(saved.response.headers.location).toBe('/forgotten-password/complete')
    expect(load(complete.result)('h1').text().trim()).toBe(
      'Your password has been reset'
    )
    expect(calls()).toEqual([
      {
        endpoint: 'start',
        body: {
          client_id: CLIENT_ID,
          username: email,
          challenge_type: 'oob redirect'
        }
      },
      {
        endpoint: 'challenge',
        body: {
          client_id: CLIENT_ID,
          continuation_token: 'ct-start',
          challenge_type: 'oob redirect'
        }
      },
      {
        endpoint: 'continue',
        body: {
          client_id: CLIENT_ID,
          continuation_token: 'ct-challenge',
          grant_type: 'oob',
          oob: '12345678'
        }
      },
      {
        endpoint: 'submit',
        body: {
          client_id: CLIENT_ID,
          continuation_token: 'ct-verified',
          new_password: NEW_PASSWORD
        }
      },
      {
        endpoint: 'poll_completion',
        body: { client_id: CLIENT_ID, continuation_token: 'ct-submitted' }
      },
      {
        endpoint: 'poll_completion',
        body: { client_id: CLIENT_ID, continuation_token: 'ct-poll' }
      }
    ])
  })

  test('Does not reveal that an email address has no account', async () => {
    entra.start.mockImplementationOnce(() =>
      json(400, { error: 'user_not_found' })
    )
    const started = await startReset()
    const codePage = await followRedirect(started.response, started.cookie)
    const attempt = await submitCode(started.cookie)

    expect(started.response.headers.location).toBe('/forgotten-password/code')
    expect(load(codePage.result)('h1').text().trim()).toBe(
      'Enter your reset code'
    )
    expect(attempt.response.statusCode).toBe(statusCodes.badRequest)
    expect(load(attempt.response.result)('#code-error').text()).toContain(
      'The reset code you entered is incorrect'
    )
    expect(entra.challenge).not.toHaveBeenCalled()
    expect(entra.continue).not.toHaveBeenCalled()
  })

  test('Lets the user retry a wrong code, then starts again after five', async () => {
    entra.continue.mockImplementation(() =>
      json(400, { error: 'invalid_grant', suberror: 'invalid_oob_value' })
    )
    const { cookie } = await startReset()
    const wrong = await submitCode(cookie, '00000000')

    expect(wrong.response.statusCode).toBe(statusCodes.badRequest)
    expect(load(wrong.response.result)('#code-error').text()).toContain(
      'The reset code you entered is incorrect'
    )

    let current = wrong
    for (let attempt = 2; attempt <= 5; attempt++) {
      current = await submitCode(current.cookie, '00000000')
    }
    const startPage = await followRedirect(current.response, current.cookie)

    expect(current.response.headers.location).toBe('/forgotten-password')
    expect(load(startPage.result)('.govuk-error-summary').text()).toContain(
      'You have entered the wrong code too many times'
    )
  })

  test('Sends a new code using the current continuation token', async () => {
    const { cookie } = await startReset()
    const resent = await inject('POST', '/forgotten-password/code/resend', {
      cookie
    })

    expect(resent.headers.location).toBe('/forgotten-password/code')
    expect(entra.challenge).toHaveBeenCalledTimes(2)
    expect(calls().at(-1)).toEqual({
      endpoint: 'challenge',
      body: {
        client_id: CLIENT_ID,
        continuation_token: 'ct-challenge',
        challenge_type: 'oob redirect'
      }
    })
  })

  test.each([
    ['password_too_weak', 'Your password is not strong enough'],
    ['password_too_short', 'Your password must be at least 8 characters'],
    ['password_recently_used', 'You have used this password recently'],
    ['password_banned', 'This password is too common']
  ])(
    'Explains an Entra %s rejection and lets the user try again',
    async (suberror, message) => {
      entra.submit.mockImplementationOnce(() =>
        json(400, { error: 'invalid_grant', suberror })
      )
      const { cookie } = await startReset()
      const verified = await submitCode(cookie)
      const rejected = await submitPassword(verified.cookie)
      const retried = await submitPassword(rejected.cookie)

      expect(rejected.response.statusCode).toBe(statusCodes.badRequest)
      expect(
        load(rejected.response.result)('#password-error').text()
      ).toContain(message)
      expect(rejected.response.result).not.toContain(NEW_PASSWORD)
      expect(retried.response.headers.location).toBe(
        '/forgotten-password/complete'
      )
    }
  )

  test('Starts again when the reset has expired at Entra', async () => {
    entra.continue.mockImplementationOnce(() =>
      json(400, { error: 'expired_token' })
    )
    const { cookie } = await startReset()
    const expired = await submitCode(cookie)
    const startPage = await followRedirect(expired.response, expired.cookie)

    expect(expired.response.headers.location).toBe('/forgotten-password')
    expect(load(startPage.result)('.govuk-error-summary').text()).toContain(
      'Your reset code has expired'
    )
  })

  test('Shows an unavailable message when Entra cannot be reached', async () => {
    entra.start.mockImplementationOnce(() => {
      throw new TypeError('fetch failed')
    })
    const { response } = await startReset()

    expect(response.statusCode).toBe(statusCodes.serviceUnavailable)
    expect(load(response.result)('.govuk-error-summary').text()).toContain(
      'Password reset is not available at the moment'
    )
  })

  test('Shows an unavailable message when Entra reports the reset failed', async () => {
    entra.poll_completion.mockReset()
    entra.poll_completion.mockImplementation(() =>
      json(200, { status: 'failed' })
    )
    const { cookie } = await startReset()
    const verified = await submitCode(cookie)
    const saved = await submitPassword(verified.cookie)

    expect(saved.response.statusCode).toBe(statusCodes.serviceUnavailable)
    expect(
      load(saved.response.result)('.govuk-error-summary').text()
    ).toContain('Password reset is not available at the moment')
  })
})
