import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#passwordResetSuccessfulController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should render the confirmation panel with the account email', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/password-reset-successful'
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('.govuk-panel__title').text().trim()).toBe(
      'A reset password email has been sent to'
    )
    expect($('.govuk-panel__body').text()).toContain('john.smith@email.com')
    expect($('a.govuk-button[href="/account"]').text().trim()).toBe(
      'Back to your account'
    )
  })
})
