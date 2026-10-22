import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('Forgotten password prototype', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => server.stop({ timeout: 0 }))

  test('Should render the screenshot form with a Back link to sign in', async () => {
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: '/forgotten-password'
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('h1').text().trim()).toBe('Forgotten your password?')
    expect($('main p').text()).toContain(
      'Enter your email address and we will send you a link to reset your password.'
    )
    expect($('.govuk-back-link').attr('href')).toBe('/sign-in')
    expect($('label[for="email"]').text().trim()).toBe('Email address')
    expect($('#email').attr('type')).toBe('email')
    expect($('#email').attr('autocomplete')).toBe('email')
    expect($('#email').attr('value')).toBeUndefined()
    expect($('form').attr('method')).toBe('post')
    expect($('form').attr('action')).toBe('/forgotten-password')
    expect($('.govuk-button').text().trim()).toBe('Send email')
  })

  test.each(['', '   ', undefined])(
    'Should validate a missing email address: %s',
    async (email) => {
      const { statusCode, result } = await server.inject({
        method: 'POST',
        url: '/forgotten-password',
        payload: email === undefined ? {} : { email }
      })
      const $ = load(result)

      expect(statusCode).toBe(statusCodes.badRequest)
      expect($('.govuk-error-summary').text()).toContain(
        'Enter your email address'
      )
      expect($('.govuk-error-summary a').attr('href')).toBe('#email')
      expect($('#email-error').text()).toContain('Enter your email address')
    }
  )

  test('Should retain an invalid email and associate its validation error', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/forgotten-password',
      payload: { email: 'not-an-email' }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('#email').val()).toBe('not-an-email')
    expect($('#email').attr('aria-describedby')).toContain('email-error')
    expect($('#email-error').text()).toContain(
      'Enter an email address in the correct format'
    )
  })

  test.each([
    'person@example.com',
    'another@example.org',
    'very.long.prototype.address+confirmation@example.com'
  ])(
    'Should show the submitted email in the confirmation panel without putting it in the URL for %s',
    async (email) => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/forgotten-password',
        payload: { email }
      })

      expect(statusCode).toBe(statusCodes.seeOther)
      expect(headers.location).toBe('/forgotten-password-confirmation')
      expect(headers.location).not.toContain(email)

      const confirmation = await server.inject({
        method: 'GET',
        url: headers.location,
        headers: { cookie: headers['set-cookie'][0].split(';')[0] }
      })
      const $ = load(confirmation.result)
      expect(confirmation.statusCode).toBe(statusCodes.ok)
      expect($('.govuk-panel--confirmation')).toHaveLength(1)
      expect($('h1').text().trim()).toBe(
        'A reset password email has been sent to'
      )
      expect($('.govuk-panel__body').text().trim()).toBe(email)
      expect($('h2').first().text()).toBe('What happens next')
      expect($('main p').text()).toContain(
        'Click the link in the email to reset your password.'
      )
      expect($('main p').text()).toContain(
        'If you do not receive the email check your spam folder.'
      )
      expect($('.govuk-back-link')).toHaveLength(0)
      expect($('.govuk-button').text().trim()).toBe('Sign in')
      expect($('.govuk-button').attr('href')).toBe('/sign-in')
    }
  )

  test('Should redirect to the form if no email has been submitted', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/forgotten-password-confirmation'
    })

    expect(response.statusCode).toBe(statusCodes.seeOther)
    expect(response.headers.location).toBe('/forgotten-password')
  })

  test('Should consume the confirmation email after displaying it once', async () => {
    const submitted = await server.inject({
      method: 'POST',
      url: '/forgotten-password',
      payload: { email: 'person@example.com' }
    })
    const confirmation = await server.inject({
      method: 'GET',
      url: submitted.headers.location,
      headers: { cookie: submitted.headers['set-cookie'][0].split(';')[0] }
    })
    const refreshed = await server.inject({
      method: 'GET',
      url: submitted.headers.location,
      headers: { cookie: confirmation.headers['set-cookie'][0].split(';')[0] }
    })

    expect(refreshed.statusCode).toBe(statusCodes.seeOther)
    expect(refreshed.headers.location).toBe('/forgotten-password')
    expect(refreshed.result ?? '').not.toContain('person@example.com')
  })

  test('Should not sign the user in when submitting a reset request', async () => {
    await server.inject({
      method: 'POST',
      url: '/forgotten-password',
      payload: { email: 'person@example.com' }
    })
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/account'
    })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe('/sign-in')
  })
})
