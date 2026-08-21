import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import * as cheerio from 'cheerio'

describe('#recordDetailsController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should render details for a submitted record', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/records/submitted-1'
    })

    expect(statusCode).toBe(statusCodes.ok)
    const $ = cheerio.load(result)

    expect($('head > title').text()).toEqual(
      expect.stringContaining('Catch record for OLGA |')
    )
    expect($('[data-testid="app-heading-title"]').text().trim()).toBe(
      'Catch record for OLGA'
    )
    expect($('[data-testid="app-record-reference"]').text().trim()).toBe(
      'A1234520260727150815'
    )

    const headings = $('.govuk-grid-column-two-thirds h2')
      .map((i, el) => $(el).text().trim())
      .get()
    expect(headings).toEqual([
      'Trips details',
      'Gear used',
      'Species caught',
      'Species not landed'
    ])

    const bodyText = $('body').text()
    expect(bodyText).toEqual(expect.stringContaining('22 July 2026'))
    expect(bodyText).toEqual(expect.stringContaining('38E95'))
    expect(bodyText).toEqual(expect.stringContaining('Pot'))
    expect(bodyText).toEqual(expect.stringContaining('15 kg'))
    expect(bodyText).toEqual(expect.stringContaining('Atlantic cod (COD)'))
    expect(bodyText).toEqual(expect.stringContaining('Yes'))

    expect(bodyText).not.toEqual(expect.stringContaining('The detailed'))

    const editLink = $('a').filter(
      (i, el) => $(el).text().trim() === 'Edit catch record'
    )
    expect(editLink.attr('href')).toBe('/records/submitted-1/edit-reason')

    const downloadButton = $('button').filter(
      (i, el) => $(el).text().trim() === 'Download PDF'
    )
    expect(downloadButton).toHaveLength(1)
    expect(downloadButton.attr('type')).toBe('button')
    expect(downloadButton.attr('href')).toBeUndefined()
    expect(downloadButton.closest('form')).toHaveLength(0)
  })

  test('Should render details for an amended record', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/records/amended-1'
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render details for a late record', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/records/late-1'
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render details for an unsent record', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/records/unsent-1'
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should 404 for an unknown record', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/records/does-not-exist'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })
})
