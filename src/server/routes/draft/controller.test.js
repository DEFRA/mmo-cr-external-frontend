import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#draftController', () => {
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
      url: '/draft'
    })

    expect(result).toEqual(
      expect.stringContaining('Create a draft catch record |')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the Back link to the records page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/draft'
    })
    const $ = load(result)

    expect($('[data-testid="app-page-navigation-back-link"]').attr('href')).toBe(
      '/records'
    )
  })

  test('Should link Complete catch record to select vessel', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/draft'
    })
    const $ = load(result)

    expect($('.govuk-button[href="/select-vessel"]').text().trim()).toBe(
      'Complete catch record'
    )
  })

  test('Should link Delete catch record to the Empty Page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/draft'
    })
    const $ = load(result)

    expect($('a[href="/not-implemented?return=/draft"]').text().trim()).toBe(
      'Delete catch record'
    )
  })
})
