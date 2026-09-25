import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#changeVesselOwnerController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should render the change in vessel ownership page', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/change-vessel-owner'
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('h1').text().trim()).toBe('Change in vessel ownership')
    expect($('.govuk-body').first().text()).toContain(
      'Registry of Shipping and Seamen'
    )
    expect($('a.govuk-button[href="/account"]').text().trim()).toBe(
      'Back to your account'
    )
  })
})
