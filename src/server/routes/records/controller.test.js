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

    expect(result).toEqual(
      expect.stringContaining('Catch records for James Smith |')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  describe('Page content', () => {
    let $

    beforeAll(async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/records'
      })
      $ = load(result)
    })

    test('Should render the page title composed with the service name', () => {
      expect($('head > title').text().trim()).toBe(
        'Catch records for James Smith | Record your catch'
      )
    })

    test('Should render the heading and Vessel owner caption', () => {
      expect($('[data-testid="app-heading-title"]').text().trim()).toBe(
        'Catch records for James Smith'
      )
      expect($('[data-testid="app-heading-caption"]').text().trim()).toBe(
        'Vessel owner'
      )
    })

    test('Should render the Important notification banner', () => {
      const $banner = $('.govuk-notification-banner')
      expect($banner).toHaveLength(1)
      expect(
        $banner.find('.govuk-notification-banner__title').text().trim()
      ).toBe('Important')
      expect($banner.text()).toContain(
        'The Catch Records service will be available from 1 October 2026.'
      )
    })

    test('Should render exactly 4 record rows', () => {
      expect($('[data-testid="app-records-row"]')).toHaveLength(4)
    })

    test('Should render the table headers in the specified order', () => {
      const headers = $('.govuk-table__header')
        .map((_i, el) => $(el).text().trim())
        .get()

      expect(headers).toEqual([
        'Trip end date',
        'Vessel',
        'Status',
        'Created by'
      ])
    })

    test('Should render all 4 canonical statuses as govukTag values', () => {
      const statuses = $('[data-testid="app-records-table"] .govuk-tag')
        .map((_i, el) => $(el).text().trim())
        .get()

      expect(statuses.sort()).toEqual(
        ['Amended', 'Late', 'Submitted', 'Unsent'].sort()
      )
    })

    test('Should render the results count text', () => {
      expect($('[data-testid="app-records-results"]').text().trim()).toBe(
        'Showing 1 to 4 of 4'
      )
    })

    test('Should NOT render the old placeholder page', () => {
      expect($.html()).not.toContain('app-placeholder-page')
    })
  })

  describe('Navigation', () => {
    let $

    beforeAll(async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/records'
      })
      $ = load(result)
    })

    test('Should link the create action button to the draft page', () => {
      expect($('.govuk-button[href="/draft"]')).toHaveLength(1)
    })

    test('Should link a draft (unsent) record to the draft action page', () => {
      expect($('a[href="/draft"]')).toHaveLength(2)
    })

    test('Should link every other record to its details page', () => {
      expect($('a[href="/records/submitted-1"]')).toHaveLength(1)
      expect($('a[href="/records/amended-1"]')).toHaveLength(1)
      expect($('a[href="/records/late-1"]')).toHaveLength(1)
      expect($('a[href="/records/unsent-1"]')).toHaveLength(0)
    })

    test('Should render a Create a new catch record button linking to draft', () => {
      const $createButton = $('.govuk-button[href="/draft"]')
      expect($createButton).toHaveLength(1)
      expect($createButton.text().trim()).toBe('Create a new catch record')
    })
  })

  describe('Pagination', () => {
    let $
    let bodyHtml

    beforeAll(async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/records'
      })
      $ = load(result)
      bodyHtml = $.html()
    })

    test('Should render a single current page with no Next link (truthful single page)', () => {
      const $pagination = $('.govuk-pagination')
      expect($pagination).toHaveLength(1)
      expect($pagination.find('.govuk-pagination__next')).toHaveLength(0)

      const $currentItem = $pagination.find('.govuk-pagination__item--current')
      expect($currentItem.text().trim()).toBe('1')
    })

    test('Should render pagination after the table and results count, and before the create action', () => {
      const tableIndex = bodyHtml.indexOf('data-testid="app-records-table"')
      const resultsIndex = bodyHtml.indexOf('data-testid="app-records-results"')
      const paginationIndex = bodyHtml.indexOf('govuk-pagination')
      const createButtonIndex = bodyHtml.indexOf('Create a new catch record')

      expect(tableIndex).toBeGreaterThan(-1)
      expect(resultsIndex).toBeGreaterThan(tableIndex)
      expect(paginationIndex).toBeGreaterThan(resultsIndex)
      expect(createButtonIndex).toBeGreaterThan(paginationIndex)
    })
  })

  describe('How to record a catch', () => {
    let $

    beforeAll(async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/records'
      })
      $ = load(result)
    })

    test('Should render the guidance content inside a collapsible details section', () => {
      const $details = $('details.govuk-details')
      expect($details).toHaveLength(1)
      expect($details.find('.govuk-details__summary-text').text().trim()).toBe(
        'How to record a catch'
      )
    })

    test('Should render the shared subsection headings', () => {
      const headings = $('.govuk-details h2')
        .map((_i, el) => $(el).text().trim())
        .get()

      expect(headings).toEqual([
        'What we need from you',
        'When to create your record',
        'Special cases: ICES areas',
        'How to create a record',
        'Get help with your record'
      ])
    })

    test('Should NOT render a Start now button (unlike the Guidance page)', () => {
      expect($('.govuk-details .govuk-button')).toHaveLength(0)
    })
  })

  describe('?page query validation', () => {
    test('Should clamp an out-of-range page rather than error', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/records?page=99'
      })

      expect(statusCode).toBe(statusCodes.ok)
    })

    test('Should reject a non-numeric page', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/records?page=not-a-number'
      })

      expect(statusCode).toBe(statusCodes.badRequest)
    })
  })
})
