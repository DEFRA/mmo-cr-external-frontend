import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#changeEmailController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should render the change email address page', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/change-email'
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('h1').text().trim()).toBe('Change email address')
    expect($('.govuk-body').text()).toContain(
      'catchrecording@marinemanagement.org.uk'
    )
  })

  test('Should link back to the account page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/change-email'
    })
    const $ = load(result)

    expect($('a.govuk-back-link').attr('href')).toBe('/account')
    expect($('a.govuk-button[href="/account"]').text().trim()).toBe(
      'Back to your account'
    )
  })
})
