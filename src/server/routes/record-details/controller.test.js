import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import * as cheerio from 'cheerio'
import * as data from '#/server/common/data/get-data.js'
import {
  SPECIES_IDS,
  mockSpeciesReferenceData,
  restoreSpeciesReferenceDataMock
} from '#/test-helpers/mock-species-reference-data.js'
import {
  mockGearsReferenceData,
  restoreGearsReferenceDataMock
} from '#/test-helpers/mock-gears-reference-data.js'
import { mockPortsReferenceData } from '#/test-helpers/mock-ports-reference-data.js'
import {
  mockVesselsReferenceData,
  VESSEL_IDS
} from '#/test-helpers/mock-vessels-reference-data.js'

beforeEach(() => {
  mockSpeciesReferenceData()
  mockGearsReferenceData()
  mockPortsReferenceData()
  mockVesselsReferenceData()
})
afterEach(() => {
  restoreSpeciesReferenceDataMock()
  restoreGearsReferenceDataMock()
})

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

  test('Should show the selected journey vessel, trip, gear and species on the amended record', async () => {
    let cookie
    for (const [url, payload] of [
      ['/select-vessel', { vesselId: VESSEL_IDS.seaSpray }],
      ['/trip-date', { tripSameDate: 'no' }],
      [
        '/trip-departure-date',
        {
          'tripDepartureDate-day': '15',
          'tripDepartureDate-month': '8',
          'tripDepartureDate-year': '2025'
        }
      ],
      [
        '/trip-return-date',
        {
          'tripReturnDate-day': '17',
          'tripReturnDate-month': '8',
          'tripReturnDate-year': '2025'
        }
      ],
      ['/departure-port', { departurePort: 'newhaven' }],
      ['/return-port', { returnPort: 'rye' }],
      [
        '/gear-selection',
        { gearIds: 'pots', potsHauled: '9', potsInWater: '3' }
      ],
      ['/statistical-area', { statisticalArea: '38f02' }],
      [
        '/species-selection',
        {
          speciesIds: 'had',
          speciesAction: 'continue',
          'weightAboveMinimum-had': '12.5'
        }
      ],
      ['/catch-not-landed', { catchNotLanded: 'no' }]
    ]) {
      const response = await server.inject({
        method: 'POST',
        url,
        payload,
        ...(cookie && { headers: { cookie } })
      })
      expect(response.statusCode, url).toBe(statusCodes.seeOther)
      cookie = response.headers['set-cookie']?.[0]?.split(';')[0] || cookie
    }

    const response = await server.inject({
      method: 'GET',
      url: '/records/amended-1',
      headers: { cookie }
    })
    const $ = cheerio.load(response.result)
    expect(response.statusCode).toBe(statusCodes.ok)
    expect($('h1').text().trim()).toBe('Catch record for SEA SPRAY')
    expect($('title').text()).toContain('Catch record for SEA SPRAY')
    expect(
      $('h2')
        .map((_, element) => $(element).text().trim())
        .get()
        .slice(0, 3)
    ).toEqual(['Trip', 'Pots', 'Species not landed'])
    expect($('body').text()).toContain('15 August 2025')
    expect($('body').text()).toContain('17 August 2025')
    expect($('body').text()).toContain('Newhaven')
    expect($('body').text()).toContain('Rye')
    expect($('body').text()).toContain('38F02')
    expect($('body').text()).toContain('9')
    expect($('body').text()).toContain('3')
    expect($('body').text()).toContain('Haddock')
    expect($('body').text()).toContain('12.5 kg')
    expect($('body').text()).toContain('No')
    expect($('.govuk-summary-list a')).toHaveLength(0)
    expect($('a[href="/records/amended-1/edit-reason"]')).toHaveLength(1)

    const submitted = await server.inject({
      method: 'GET',
      url: '/records/submitted-1',
      headers: { cookie }
    })
    expect(cheerio.load(submitted.result)('h1').text().trim()).toBe(
      'Catch record for OLGA'
    )
  })

  test('Should display saved mesh measurements and omit pots counts for a different selected gear', async () => {
    const selection = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: {
        gearIds: 'bottom-otter-trawl',
        'bottom-otter-trawl-meshSize': '125'
      }
    })
    expect(selection.statusCode).toBe(statusCodes.seeOther)
    const cookie = selection.headers['set-cookie'][0].split(';')[0]
    const response = await server.inject({
      method: 'GET',
      url: '/records/amended-1',
      headers: { cookie }
    })
    const $ = cheerio.load(response.result)
    const gear = $('section[aria-labelledby^="gear-summary-"]').filter(
      (_, element) => $(element).text().includes('Bottom otter trawl')
    )

    expect(response.statusCode).toBe(statusCodes.ok)
    expect(
      gear
        .find('dt')
        .map((_, element) => $(element).text().trim())
        .get()
    ).toEqual(['Gear', 'Mesh size (mm)', 'Statistical area / sub area'])
    expect(
      gear
        .find('.govuk-summary-list__value')
        .map((_, element) => $(element).text().trim())
        .get()
    ).toEqual(['Bottom otter trawl', '125', 'Not entered'])
  })

  test('Should render stored gear groups read-only without borrowing current journey answers', async () => {
    const originalGetData = data.getData
    const details = {
      ...originalGetData('catchRecordDetails'),
      vesselName: 'ACHILLES',
      selectedGearIds: ['pots', 'dredge'],
      catchDetailsByGearId: {
        pots: {
          statAreaBranch: 'direct',
          selectedStatisticalArea: '38E95',
          selectedSpeciesIds: [SPECIES_IDS.cod],
          speciesWeights: { [SPECIES_IDS.cod]: { weightAboveMinimum: 15 } },
          catchNotLanded: false
        },
        dredge: {
          statAreaBranch: 'direct',
          selectedStatisticalArea: '38E96',
          selectedSpeciesIds: [SPECIES_IDS.cod],
          speciesWeights: { [SPECIES_IDS.cod]: { weightAboveMinimum: 30 } },
          catchNotLanded: false
        }
      }
    }
    const spy = vi
      .spyOn(data, 'getData')
      .mockImplementation((key) =>
        key === 'allRecords'
          ? [{ recordId: 'grouped-record', status: 'Submitted', details }]
          : originalGetData(key)
      )
    mockSpeciesReferenceData()
    mockGearsReferenceData()
    try {
      const response = await server.inject({
        method: 'GET',
        url: '/records/grouped-record'
      })
      expect(response.statusCode).toBe(200)
      const $ = cheerio.load(response.result)
      const groups = $('section[aria-labelledby^="gear-summary-"]')
      expect(groups).toHaveLength(2)
      expect(groups.eq(0).text()).toContain('15 kg')
      expect(groups.eq(1).text()).toContain('30 kg')
      expect(groups.find('.govuk-summary-list__actions a')).toHaveLength(0)
      expect($('dt:contains("Vessel")').next().text().trim()).toBe('ACHILLES')
    } finally {
      spy.mockRestore()
      restoreGearsReferenceDataMock()
      restoreSpeciesReferenceDataMock()
    }
  })

  test('Should render the Figma late record detail and edit action', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/records/late-1'
    })
    const $ = cheerio.load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('[data-testid="app-record-reference"]').text().trim()).toBe(
      'CC-2026-123456'
    )
    expect($('[data-testid="app-heading-title"]').text().trim()).toBe(
      'Catch record for OLGA'
    )
    expect($('body').text()).toContain('Record status:')
    expect(
      $('a')
        .filter(
          (_, element) => $(element).text().trim() === 'Edit catch record'
        )
        .attr('href')
    ).toBe('/records/late-1/edit-reason')
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
