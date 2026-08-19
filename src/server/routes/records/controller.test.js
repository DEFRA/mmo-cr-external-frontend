import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#recordsController', () => {
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
      url: '/records'
    })

    expect(result).toEqual(expect.stringContaining('Your catch records |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should link the unsent record to the draft page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/records'
    })
    const $ = load(result)

    expect($('a[href="/draft"]').first().text().trim()).toBe('unsent-1')
  })

  test('Should link the other records to their details page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/records'
    })
    const $ = load(result)

    expect($('a[href="/records/submitted-1"]')).toHaveLength(1)
    expect($('a[href="/records/amended-1"]')).toHaveLength(1)
    expect($('a[href="/records/late-1"]')).toHaveLength(1)
  })

  test('Should render a Create a new catch record button linking to draft', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/records'
    })
    const $ = load(result)

    const $createButton = $('.govuk-button[href="/draft"]')
    expect($createButton).toHaveLength(1)
    expect($createButton.text().trim()).toBe('Create a new catch record')
  })
})
