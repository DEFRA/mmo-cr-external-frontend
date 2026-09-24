import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#changeContactNumberController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should render the change contact number page', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/change-contact-number'
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('h1').text().trim()).toBe('Change contact number')
    expect($('.govuk-body').text()).toContain(
      'catchrecording@marinemanagement.org.uk'
    )
    expect($('a.govuk-button[href="/account"]').text().trim()).toBe(
      'Back to your account'
    )
  })
})
