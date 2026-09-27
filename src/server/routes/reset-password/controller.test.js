import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#resetPasswordController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should render the reset password page', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/reset-password'
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('h1').text().trim()).toBe('Reset password')
    expect($('button.govuk-button').text().trim()).toBe(
      'Send reset password email'
    )
  })

  test('Should redirect to the password reset confirmation page on submission', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/reset-password'
    })

    expect(statusCode).toBe(statusCodes.seeOther)
    expect(headers.location).toBe('/password-reset-successful')
  })
})
