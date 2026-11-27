import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

const cookieFrom = (response, fallback) =>
  response.headers['set-cookie']?.[0]?.split(';')[0] ?? fallback

// Reset requests are rate limited per address, so each journey uses its own.
let emailCount = 0
const uniqueEmail = () => `person${++emailCount}@example.com`

describe('Forgotten password journey (mock authentication)', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => server.stop({ timeout: 0 }))

  const inject = (method, url, { cookie, payload } = {}) =>
    server.inject({
      method,
      url,
      payload,
      headers: cookie ? { cookie } : {}
    })

  async function startReset(email = uniqueEmail()) {
    const response = await inject('POST', '/forgotten-password', {
      payload: { email }
    })
    return { response, cookie: cookieFrom(response) }
  }

  async function verifiedReset() {
    const { cookie } = await startReset()
    const verified = await inject('POST', '/forgotten-password/code', {
      cookie,
      payload: { code: '12345678' }
    })
    return cookieFrom(verified, cookie)
  }

  test('Should render the reset your password page from the design', async () => {
    const { statusCode, result, headers } = await inject(
      'GET',
      '/forgotten-password'
    )
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect(headers['cache-control']).toBe('no-store')
    expect($('h1').text().trim()).toBe('Reset your password')
    expect($('main p').first().text()).toBe(
      'Enter the email address you use to sign in.'
    )
    expect($('.govuk-back-link').attr('href')).toBe('/sign-in')
    expect($('label[for="email"]').text().trim()).toBe('Email address')
    expect($('#email-hint').text().trim()).toBe(
      "If an account exists for this email address, we'll send a reset code."
    )
    expect($('#email').attr('type')).toBe('email')
    expect($('form').attr('action')).toBe('/forgotten-password')
    expect($('.govuk-button').text().trim()).toBe('Send reset code')
  })

  test.each(['', '   ', undefined])(
    'Should validate a missing email address: %s',
    async (email) => {
      const { statusCode, result } = await inject(
        'POST',
        '/forgotten-password',
        { payload: email === undefined ? {} : { email } }
      )
      const $ = load(result)

      expect(statusCode).toBe(statusCodes.badRequest)
      expect($('.govuk-error-summary')).toHaveLength(1)
      expect($('.govuk-error-summary a').attr('href')).toBe('#email')
      expect($('#email-error').text()).toContain('Enter your email address')
    }
  )

  test('Should keep an invalid email and explain the format', async () => {
    const { statusCode, result } = await inject('POST', '/forgotten-password', {
      payload: { email: 'not-an-email' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('#email').val()).toBe('not-an-email')
    expect($('#email-error').text()).toContain(
      'Enter an email address in the correct format'
    )
  })

  test('Should send a reset code without putting the email in the URL', async () => {
    const { response, cookie } = await startReset('person@example.com')
    const page = await inject('GET', '/forgotten-password/code', { cookie })
    const $ = load(page.result)

    expect(response.statusCode).toBe(statusCodes.seeOther)
    expect(response.headers.location).toBe('/forgotten-password/code')
    expect(page.statusCode).toBe(statusCodes.ok)
    expect($('h1').text().trim()).toBe('Enter your reset code')
    expect($('main').text()).toContain(
      'Enter the code we sent to your email address.'
    )
    expect($('main').text()).toContain('This code will expire after 5 minutes.')
    expect($('label[for="code"]').text().trim()).toBe('Reset code')
    expect($('#code').attr('autocomplete')).toBe('one-time-code')
    expect($('.govuk-button').first().text().trim()).toBe('Continue')
    expect($('.govuk-button--secondary').attr('formaction')).toBe(
      '/forgotten-password/code/resend'
    )
    expect(page.result).not.toContain('person@example.com')
  })

  test('Should require a code and keep the user on the code page', async () => {
    const { cookie } = await startReset()
    const response = await inject('POST', '/forgotten-password/code', {
      cookie,
      payload: { code: '  ' }
    })
    const $ = load(response.result)

    expect(response.statusCode).toBe(statusCodes.badRequest)
    expect($('#code-error').text()).toContain('Enter your reset code')
    expect($('.govuk-error-summary a').attr('href')).toBe('#code')
  })

  test('Should confirm a new code has been sent', async () => {
    const { cookie } = await startReset()
    const resent = await inject('POST', '/forgotten-password/code/resend', {
      cookie
    })
    const page = await inject('GET', '/forgotten-password/code', {
      cookie: cookieFrom(resent, cookie)
    })

    expect(resent.headers.location).toBe('/forgotten-password/code')
    expect(load(page.result)('.govuk-notification-banner').text()).toContain(
      'We have sent you a new code.'
    )
  })

  test('Should render the create new password page with show and hide controls', async () => {
    const cookie = await verifiedReset()
    const page = await inject('GET', '/forgotten-password/new-password', {
      cookie
    })
    const $ = load(page.result)

    expect(page.statusCode).toBe(statusCodes.ok)
    expect($('h1').text().trim()).toBe('Create your new password')
    expect($('main').text()).toContain(
      'Your password must be at least 8 characters.'
    )
    expect($('.govuk-back-link').attr('href')).toBe('/forgotten-password/code')
    expect($('label[for="password"]').text().trim()).toBe('New password')
    expect($('label[for="confirmPassword"]').text().trim()).toBe(
      'Confirm new password'
    )
    expect($('[data-module="govuk-password-input"]')).toHaveLength(2)
    expect($('#password').attr('autocomplete')).toBe('new-password')
    expect($('.govuk-js-password-input-toggle').first().text().trim()).toBe(
      'Show'
    )
    expect($('form > .govuk-button').text().trim()).toBe('Save and continue')
  })

  test.each([
    [{ password: '', confirmPassword: '' }, 'password', 'Enter a new password'],
    [
      { password: 'Abcdefg1!', confirmPassword: '' },
      'confirmPassword',
      'Confirm your new password'
    ],
    [
      { password: 'short', confirmPassword: 'short' },
      'password',
      'Your password must be at least 8 characters'
    ],
    [
      { password: 'Abcdefg1!', confirmPassword: 'Abcdefg2!' },
      'confirmPassword',
      'Passwords do not match'
    ]
  ])('Should validate the new password %o', async (payload, field, message) => {
    const cookie = await verifiedReset()
    const response = await inject('POST', '/forgotten-password/new-password', {
      cookie,
      payload
    })
    const $ = load(response.result)

    expect(response.statusCode).toBe(statusCodes.badRequest)
    expect($(`#${field}-error`).text()).toContain(message)
    expect(response.result).not.toContain(payload.password || 'x-never-x')
  })

  test('Should finish on the password reset page with a Sign in button', async () => {
    const cookie = await verifiedReset()
    const saved = await inject('POST', '/forgotten-password/new-password', {
      cookie,
      payload: { password: 'Abcdefg1!', confirmPassword: 'Abcdefg1!' }
    })
    const completeCookie = cookieFrom(saved, cookie)
    const complete = await inject('GET', '/forgotten-password/complete', {
      cookie: completeCookie
    })
    const $ = load(complete.result)

    expect(saved.headers.location).toBe('/forgotten-password/complete')
    expect($('h1').text().trim()).toBe('Your password has been reset')
    expect($('.govuk-button').text().trim()).toBe('Sign in')
    expect($('.govuk-button').attr('href')).toBe('/sign-in')
    expect($('.govuk-back-link')).toHaveLength(0)

    const refreshed = await inject('GET', '/forgotten-password/complete', {
      cookie: cookieFrom(complete, completeCookie)
    })
    expect(refreshed.headers.location).toBe('/forgotten-password')
  })

  test.each([
    ['GET', '/forgotten-password/code'],
    ['GET', '/forgotten-password/new-password'],
    ['GET', '/forgotten-password/complete']
  ])(
    'Should send %s %s back to the start without a reset',
    async (method, url) => {
      const response = await inject(method, url)

      expect(response.statusCode).toBe(statusCodes.seeOther)
      expect(response.headers.location).toBe('/forgotten-password')
    }
  )

  test('Should not allow the new password page before the code is verified', async () => {
    const { cookie } = await startReset()
    const response = await inject('GET', '/forgotten-password/new-password', {
      cookie
    })

    expect(response.headers.location).toBe('/forgotten-password')
  })

  test('Should not sign the user in', async () => {
    const cookie = await verifiedReset()
    const response = await inject('GET', '/account', { cookie })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/sign-in')
  })

  test('Should limit how many reset codes one address can request', async () => {
    const email = uniqueEmail()
    const responses = []
    for (let request = 0; request < 6; request++) {
      responses.push((await startReset(email)).response)
    }
    const limited = responses.at(-1)

    expect(responses.slice(0, 5).map((r) => r.statusCode)).toEqual(
      Array(5).fill(statusCodes.seeOther)
    )
    expect(limited.statusCode).toBe(statusCodes.tooManyRequests)
    expect(load(limited.result)('.govuk-error-summary').text()).toContain(
      'You have requested too many reset codes'
    )
  })
})
