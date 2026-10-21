import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import * as data from '#/server/common/data/get-data.js'
import {
  mockVesselsReferenceData,
  restoreVesselsReferenceDataMock
} from '#/test-helpers/mock-vessels-reference-data.js'

beforeEach(() => mockVesselsReferenceData())
afterEach(() => restoreVesselsReferenceDataMock())

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
        'Your catch records | Record your catch'
      )
    })

    test('Should render the catch records heading without an account role caption', () => {
      expect($('[data-testid="app-heading-title"]').text().trim()).toBe(
        'Your catch records'
      )
      expect($('[data-testid="app-heading-caption"]')).toHaveLength(0)
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

    test('Should show the designed vessel name for each record', () => {
      const vesselNames = $('[data-testid="app-records-row"]')
        .map((_i, row) => $(row).find('.govuk-table__cell').eq(1).text().trim())
        .get()

      expect(vesselNames).toEqual(['OLGA', 'OLGA', 'OLGA', 'OLGA'])
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

    test('Should link the create action button directly to vessel selection', () => {
      expect($('.govuk-button[href="/select-vessel"]')).toHaveLength(1)
      expect($('.govuk-button[href="/draft"]')).toHaveLength(0)
    })

    test('Should open vessel selection when following the create action', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: $('.govuk-button').attr('href')
      })
      const $vesselPage = load(result)

      expect(statusCode).toBe(statusCodes.ok)
      expect($vesselPage('h1').text()).toContain('Which vessel did you use?')
      expect($vesselPage('input[name="vesselId"]')).toHaveLength(2)
      expect($vesselPage('input[name="draftAction"]')).toHaveLength(0)
      expect(
        $vesselPage('[data-testid="app-page-navigation-back-link"]').attr(
          'href'
        )
      ).toBe('/records')
    })

    test('Should link a draft (unsent) record to the draft action page', () => {
      const $draftLink = $('[data-testid="app-records-row"] a[href="/draft"]')
      expect($draftLink).toHaveLength(1)
      expect($draftLink.closest('tr').find('.govuk-tag').text().trim()).toBe(
        'Unsent'
      )
      expect($('a[href="/draft"]')).toHaveLength(1)
    })

    test('Should open the draft actions when following a draft record link', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: $('[data-testid="app-records-row"] a[href="/draft"]').attr('href')
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(load(result)('h1').text()).toContain(
        'What do you want to do with your draft record?'
      )
    })

    test('Should link every other record to its details page', () => {
      expect($('a[href="/records/submitted-1"]')).toHaveLength(1)
      expect($('a[href="/records/amended-1"]')).toHaveLength(1)
      expect($('a[href="/records/late-1"]')).toHaveLength(1)
      expect($('a[href="/records/unsent-1"]')).toHaveLength(0)
    })

    test('Should render a Create a new catch record button linking to vessel selection', () => {
      const $createButton = $('.govuk-button[href="/select-vessel"]')
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

    test('Should render Previous and Next controls with the current page number', () => {
      const $pagination = $('.govuk-pagination')
      expect($pagination).toHaveLength(1)
      expect($pagination.find('.govuk-pagination__next')).toHaveLength(0)

      const $currentItem = $pagination.find('.govuk-pagination__item--current')
      expect($currentItem.text().trim()).toBe('1')
      expect(
        $('.app-records-pagination__summary .app-records-pagination__control')
      ).toHaveLength(1)
      expect($('.app-records-pagination__next')).toHaveLength(1)
      expect(
        $('.app-records-pagination__control--disabled[aria-disabled="true"]')
          .map((_i, el) => $(el).find('svg').attr('class'))
          .get()
      ).toEqual([
        'govuk-pagination__icon govuk-pagination__icon--prev',
        'govuk-pagination__icon govuk-pagination__icon--next'
      ])
      expect(
        $(
          '.app-records-pagination__control svg[aria-hidden="true"][focusable="false"]'
        )
      ).toHaveLength(2)
      expect(
        $('.app-records-pagination__next .app-records-pagination__label').text()
      ).toBe('Next')
      expect(
        $('.app-records-pagination__summary .app-records-pagination__label')
      ).toHaveLength(0)
      expect($('.app-records-pagination__next').hasClass('govuk-link')).toBe(
        true
      )
      expect(
        $('.app-records-pagination__summary').find(
          '.app-records-pagination__control'
        )
      ).toHaveLength(1)
      expect(
        $('[data-testid="app-records-results"]').hasClass(
          'govuk-!-font-weight-bold'
        )
      ).toBe(true)
    })

    test('Should preserve the enabled Next and Previous page destinations with GOV.UK arrows', async () => {
      const originalGetData = data.getData
      const records = originalGetData('allRecords')
      const getDataSpy = vi.spyOn(data, 'getData').mockImplementation((name) =>
        name === 'allRecords'
          ? Array.from({ length: 12 }, (_, index) => ({
              ...records[index % records.length],
              recordId: `pagination-record-${index}`
            }))
          : originalGetData(name)
      )

      try {
        const firstPage = await server.inject({
          method: 'GET',
          url: '/records'
        })
        const $first = load(firstPage.result)
        expect(
          $first('.app-records-pagination__next[rel="next"]').attr('href')
        ).toBe('/records?page=2')
        expect(
          $first('.app-records-pagination__next .govuk-pagination__icon--next')
        ).toHaveLength(1)

        const secondPage = await server.inject({
          method: 'GET',
          url: '/records?page=2'
        })
        const $second = load(secondPage.result)
        expect(
          $second('.app-records-pagination__summary a[rel="prev"]').attr('href')
        ).toBe('/records?page=1')
        expect(
          $second(
            '.app-records-pagination__summary .govuk-pagination__icon--prev'
          )
        ).toHaveLength(1)
        expect(
          $second('.app-records-pagination__next[aria-disabled="true"]')
        ).toHaveLength(1)
      } finally {
        getDataSpy.mockRestore()
      }
    })

    test('Should render the create action before the table and pagination after it', () => {
      const tableIndex = bodyHtml.indexOf('data-testid="app-records-table"')
      const resultsIndex = bodyHtml.indexOf('data-testid="app-records-results"')
      const paginationIndex = bodyHtml.indexOf('class="govuk-pagination"')
      const createButtonIndex = bodyHtml.indexOf('Create a new catch record')

      expect(createButtonIndex).toBeGreaterThan(-1)
      expect(createButtonIndex).toBeLessThan(tableIndex)
      expect(tableIndex).toBeGreaterThan(-1)
      expect(resultsIndex).toBeGreaterThan(tableIndex)
      expect(paginationIndex).toBeGreaterThan(resultsIndex)
    })
  })

  describe('Record help sections', () => {
    let $

    beforeAll(async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/records'
      })
      $ = load(result)
    })

    test('Should render both guidance sections expanded', () => {
      const $details = $('details.govuk-details')
      expect($details).toHaveLength(2)
      expect($details.eq(0).attr('open')).toBeDefined()
      expect($details.eq(1).attr('open')).toBeDefined()
      expect(
        $details
          .find('.govuk-details__summary-text')
          .map((_i, el) => $(el).text().trim())
          .get()
      ).toEqual(['Help with catch recording', 'Catch record statuses'])
    })

    test('Should render the catch recording guidance', () => {
      const headings = $('details')
        .eq(0)
        .find('h2')
        .map((_i, el) => $(el).text().trim())
        .get()

      expect(headings).toEqual([
        'What you need to do',
        'When to create your record',
        'Special cases: ICES areas',
        'Get help with your record'
      ])
      expect($('details').eq(0).text()).toContain(
        'You must record all catches unless an exemption applies.'
      )
    })

    test('Should explain the four catch record statuses', () => {
      const statuses = $('details')
        .eq(1)
        .find('strong')
        .map((_i, el) => $(el).text().trim())
        .get()

      expect(statuses).toEqual(['Unsent:', 'Submitted:', 'Amended:', 'Late:'])
      expect($('details').eq(1).text()).toContain(
        'Saved on your device and not yet submitted.'
      )
      expect($('details').eq(1).text()).toContain(
        'This record was submitted and received late by the MMO.'
      )
      const $guidanceLink = $('details').eq(1).find('a')
      expect($guidanceLink).toHaveLength(1)
      expect($guidanceLink.attr('href')).toBe('/')
    })

    test('Should open the How to record your catch page from the guidance link', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: $('details').eq(1).find('a').attr('href')
      })

      expect(statusCode).toBe(statusCodes.ok)
      expect(
        load(result)('[data-testid="app-heading-title"]').text().trim()
      ).toBe('How to record your catch')
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
