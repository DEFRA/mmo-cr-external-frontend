import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#confirmationController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should provide expected response', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/confirmation'
    })

    expect(result).toEqual(expect.stringContaining('Catch record submitted |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should NOT render a Back link on the confirmation page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/confirmation'
    })
    const $ = load(result)

    expect($('[data-testid="app-page-navigation-back-link"]')).toHaveLength(0)
  })

  test('Should link to the records page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/confirmation'
    })
    const $ = load(result)

    expect($('a[href="/records"]').text().trim()).toBe(
      'View your catch records'
    )
  })

  test('Should render the confirmation reference number', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/confirmation'
    })
    const $ = load(result)

    expect($('.govuk-body').text()).toContain('A1234520260727150815')
  })
})
