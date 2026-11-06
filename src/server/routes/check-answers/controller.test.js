import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import {
  mockSpeciesReferenceData,
  restoreSpeciesReferenceDataMock
} from '#/test-helpers/mock-species-reference-data.js'
import { mockPortsReferenceData } from '#/test-helpers/mock-ports-reference-data.js'
import { mockGearsReferenceData } from '#/test-helpers/mock-gears-reference-data.js'
import * as checkAnswersViewModel from './view-model.js'
import {
  mockCatchRecording,
  restoreCatchRecordingMock,
  CREATED_DRAFT,
  RETRIEVED_DRAFT
} from '#/test-helpers/mock-catch-recording.js'
import {
  mockVesselsReferenceData,
  restoreVesselsReferenceDataMock,
  VESSEL_IDS
} from '#/test-helpers/mock-vessels-reference-data.js'

beforeEach(() => {
  mockSpeciesReferenceData()
  mockPortsReferenceData()
  mockGearsReferenceData()
  mockVesselsReferenceData()
  mockCatchRecording()
})
afterEach(() => {
  restoreVesselsReferenceDataMock()
  restoreSpeciesReferenceDataMock()
  restoreCatchRecordingMock()
})

describe('#checkAnswersController', () => {
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
      url: '/check-answers'
    })

    expect(result).toEqual(expect.stringContaining('Check your catch record'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the review heading, reference and designed section order', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/check-answers'
    })
    const $ = load(result)

    expect($('h1').text().trim()).toBe('Check your catch record')
    expect($('[data-testid="app-check-answers-reference"]').text().trim()).toBe(
      'A1234520260727150815'
    )
    expect(
      $('h2.govuk-heading-l')
        .map((_, el) => $(el).text().trim())
        .get()
    ).toEqual([
      'Trips details',
      '2. Gear used',
      '3. Species caught',
      'Species not landed'
    ])
  })

  test('Should render Change links, the declaration and the submit action', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/check-answers'
    })
    const $ = load(result)

    expect(
      $('main a').filter((_, el) => $(el).text().trim().startsWith('Change'))
        .length
    ).toBeGreaterThan(0)
    expect($('.govuk-warning-text').text()).toContain(
      "By submitting this record, you agree that the information you've given is complete and correct."
    )
    expect($('.govuk-body').text()).toContain(
      "By submitting your catch record, you're confirming:"
    )
    expect(
      $('.govuk-list--bullet li')
        .map((_, li) => $(li).text())
        .get()
    ).toEqual([
      'The weight of fish you have landed is accurate',
      'This is within permitted tolerance levels',
      'Fishing authorities may take action in respect of inaccurate catch recording'
    ])
    expect($('.govuk-warning-text').index()).toBeLessThan(
      $('.govuk-body').index()
    )
    expect($('main input[name="confirmAccurate"]')).toHaveLength(0)
    expect($('main button').text().trim()).toBe(
      'Accept and submit trip details'
    )
    expect($('.govuk-back-link').attr('href')).toBe('/catch-not-landed')
    const tripRows = $('main .govuk-summary-list')
      .first()
      .find('.govuk-summary-list__row')
    expect(
      tripRows
        .find('dt')
        .map((_, row) => $(row).text().trim())
        .get()
    ).toEqual([
      'Vessel',
      'Departure date',
      'Return date',
      'Departure port',
      'Return port',
      'Statistical sub area'
    ])
    expect(tripRows.first().find('a')).toHaveLength(0)
    expect(tripRows.slice(1).find('a')).toHaveLength(5)
    expect($('dt').text()).toContain('Not landed')
  })

  test('Should render Change links supplied by the review view model', async () => {
    const buildViewModel = vi.spyOn(
      checkAnswersViewModel,
      'buildCheckAnswersViewModel'
    )
    buildViewModel.mockReturnValue({
      sections: [
        {
          heading: '1. Trips details',
          rows: [
            {
              key: { text: 'Vessel' },
              value: { text: 'OLGA' },
              actions: { items: [{ href: '/select-vessel', text: 'Change' }] }
            }
          ]
        }
      ],
      gearGroups: [],
      speciesGroups: [],
      trailingSections: []
    })
    try {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/check-answers'
      })
      const $ = load(result)
      expect(statusCode).toBe(statusCodes.ok)
      expect($('main').text()).toContain('OLGA')
      expect(
        $('main a').filter((_, el) => $(el).text().trim() === 'Change')
      ).toHaveLength(1)
    } finally {
      buildViewModel.mockRestore()
    }
  })

  test('Should preserve record data while using the review layout', async () => {
    const source = await server.inject({
      method: 'GET',
      url: '/records/submitted-1'
    })
    const review = await server.inject({ method: 'GET', url: '/check-answers' })
    const $source = load(source.result)
    const $review = load(review.result)

    expect($source('main').text()).toContain('OLGA')
    expect($review('h1').text()).toContain('Check your catch record')
    expect($review('main').text()).toContain('Atlantic cod')
    expect($review('main').text()).toContain('15')
    expect($review('main a').length).toBeGreaterThan(0)
  })

  test('Should render the illustrative example values when no journey state exists', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/check-answers'
    })
    const $ = load(result)

    expect($('dd').eq(0).text().trim()).toBe('OLGA')
  })

  test('Should retrieve the persisted record without displaying status and progress', async () => {
    const selection = await server.inject({
      method: 'POST',
      url: '/select-vessel',
      payload: { vesselId: VESSEL_IDS.achilles }
    })
    const cookie = selection.headers['set-cookie'][0].split(';')[0]
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/check-answers',
      headers: { cookie }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.ok)
    expect($('[data-testid="app-record-status"]')).toHaveLength(0)
    expect($('[data-testid="app-record-progress"]')).toHaveLength(0)
    expect($('[data-testid="app-record-submission-eligibility"]')).toHaveLength(
      0
    )
    expect($('main').text()).not.toContain('Record status and progress')
    expect($('main').text()).not.toContain('This is a preliminary check.')
    expect($('h1').text()).toContain('Check your catch record')
    expect($('form[method="post"]')).toHaveLength(1)
    expect(
      globalThis.fetch.mock.calls.some(([url]) =>
        url.endsWith(`/v1/catch-records/${CREATED_DRAFT.id}`)
      )
    ).toBe(true)
    expect(RETRIEVED_DRAFT.incompleteSections).toEqual(['trip', 'gears'])
  })

  test('Should reflect real captured journey answers over the illustrative example', async () => {
    const tripDateResponse = await server.inject({
      method: 'POST',
      url: '/trip-date',
      payload: { tripSameDate: 'yes' }
    })
    let cookie = tripDateResponse.headers['set-cookie'][0].split(';')[0]

    const steps = [
      ['/departure-port', { departurePort: 'newhaven' }],
      ['/return-port', { returnPort: 'rye' }],
      ['/gear-selection', { gearIds: 'dredge' }],
      ['/statistical-area', { statisticalArea: '38f02' }],
      [
        '/species-selection',
        {
          speciesIds: 'cod',
          speciesAction: 'continue',
          'weightAboveMinimum-cod': '3'
        }
      ],
      ['/catch-not-landed', { catchNotLanded: 'no' }]
    ]

    for (const [url, payload] of steps) {
      const response = await server.inject({
        method: 'POST',
        url,
        payload,
        headers: { cookie }
      })
      cookie = response.headers['set-cookie'][0].split(';')[0]
    }

    const { result } = await server.inject({
      method: 'GET',
      url: '/check-answers',
      headers: { cookie }
    })
    const $ = load(result)
    const text = $.text()

    expect(text).toContain('Newhaven')
    expect(text).toContain('Rye')
    expect(text).toContain('Dredge')
    expect($('h2').text()).toContain('Species not landed')
    expect($('dt:contains("Not landed")').next().text().trim()).toBe('No')
  })
})

describe('Check-answers submission route', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should return users with no selected gear to the journey before submission without a checkbox', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/check-answers',
      payload: {}
    })

    expect(statusCode).toBe(statusCodes.seeOther)
    expect(headers.location).toBe('/gear-selection')
  })
})

describe('#checkAnswers change loop', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should return to Check Your Answers after changing the departure port', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/departure-port?return=/check-answers',
      payload: { departurePort: 'hastings' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/check-answers')
  })

  test('Should collect answers before returning to Check Your Answers for a newly selected gear', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/gear-selection?return=/check-answers',
      payload: { gearIds: 'dredge' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/statistical-area?gearId=dredge')
  })

  test('Should ignore an unsafe return destination and continue the default journey', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/departure-port?return=https://evil.example',
      payload: { departurePort: 'hastings' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/return-port')
  })
})
