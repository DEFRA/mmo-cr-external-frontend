import { load } from 'cheerio'
import { createServer } from '#/server/server.js'
import {
  SPECIES_IDS,
  mockSpeciesReferenceData,
  restoreSpeciesReferenceDataMock
} from '#/test-helpers/mock-species-reference-data.js'
import {
  mockPortsReferenceData,
  restorePortsReferenceDataMock
} from '#/test-helpers/mock-ports-reference-data.js'
import {
  mockGearsReferenceData,
  restoreGearsReferenceDataMock
} from '#/test-helpers/mock-gears-reference-data.js'

describe('per-gear catch journey', () => {
  let server
  let cookie

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })
  afterAll(async () => server.stop({ timeout: 0 }))
  beforeEach(() => {
    mockSpeciesReferenceData()
    mockPortsReferenceData()
    mockGearsReferenceData()
    cookie = undefined
  })
  afterEach(() => {
    restoreGearsReferenceDataMock()
    restorePortsReferenceDataMock()
    restoreSpeciesReferenceDataMock()
  })

  async function inject(method, url, payload) {
    const response = await server.inject({
      method,
      url,
      ...(payload && { payload }),
      ...(cookie && { headers: { cookie } })
    })
    if (response.headers['set-cookie']) {
      cookie = response.headers['set-cookie'][0].split(';')[0]
    }
    return response
  }

  async function start(gearIds = ['pots', 'dredge']) {
    await inject('POST', '/departure-port', { departurePort: 'hastings' })
    const response = await inject('POST', '/gear-selection', {
      gearIds,
      potsHauled: '7',
      potsInWater: '5'
    })
    expect(response.statusCode).toBe(303)
    return response
  }

  async function catchFor(gearId, area, weight) {
    await inject('POST', `/statistical-area?gearId=${gearId}`, {
      statisticalArea: area
    })
    const speciesResponse = await inject(
      'POST',
      `/species-selection?gearId=${gearId}`,
      {
        speciesIds: SPECIES_IDS.cod,
        speciesAction: 'continue',
        [`weightAboveMinimum-${SPECIES_IDS.cod}`]: weight,
        [`weightBelowMinimum-${SPECIES_IDS.cod}`]: '2'
      }
    )
    expect(speciesResponse.statusCode).toBe(303)
    return speciesResponse
  }

  async function finishTrip() {
    return inject('POST', '/catch-not-landed', { catchNotLanded: 'no' })
  }

  test('loops immediately after species and records unlanded catch once for the trip', async () => {
    expect((await start()).headers.location).toBe(
      '/statistical-area?gearId=pots'
    )
    const first = await catchFor('pots', '38E95', '15')
    expect(first.headers.location).toBe('/statistical-area?gearId=dredge')
    const second = await catchFor('dredge', '38E96', '30')
    expect(second.headers.location).toBe('/catch-not-landed')
    const yes = await inject('POST', second.headers.location, {
      catchNotLanded: 'yes'
    })
    expect(yes.headers.location).toBe('/species-not-landed')
    const kept = await inject('POST', yes.headers.location, {
      speciesIds: SPECIES_IDS.cod,
      [`weightAboveMinimum-${SPECIES_IDS.cod}`]: '5'
    })
    expect(kept.headers.location).toBe('/check-answers')
    const summary = await inject('GET', '/check-answers')
    expect(summary.statusCode).toBe(200)
    const $ = load(summary.result)
    const groups = $('section[aria-labelledby^="gear-summary-"]')
    expect(groups).toHaveLength(2)
    expect(groups.eq(0).find('h2').text()).toBe('Pots')
    expect(groups.eq(0).text()).toContain('38E95')
    expect(groups.eq(0).text()).toContain('15 kg')
    expect(groups.eq(0).text()).toContain('2 kg')
    expect(groups.eq(1).find('h2').text()).toBe('Dredge')
    expect(groups.eq(1).text()).toContain('38E96')
    expect(groups.eq(1).text()).toContain('30 kg')
    expect(groups.eq(1).text()).not.toContain('15 kg')
    expect(groups.find('dt:contains("Not landed")')).toHaveLength(0)
    expect($('dt:contains("Not landed")')).toHaveLength(0)
    expect(
      $('h2').filter((_, element) => $(element).text() === 'Species not landed')
    ).toHaveLength(1)
    expect($('h3, h4')).toHaveLength(0)
    expect($('dt:contains("Weight kept onboard")').next().text().trim()).toBe(
      '5 kg'
    )
    expect(
      groups
        .eq(0)
        .find('dt')
        .map((_, element) => $(element).text().trim())
        .get()
    ).toEqual([
      'Gear',
      'Total pots or traps hauled',
      'Total pots or traps left in water',
      'Statistical area / sub area',
      'Species',
      'Weight above minimum size retained',
      'Weight below minimum size retained'
    ])
    expect($('.app-catch-summary-list').length).toBeGreaterThan(0)
    expect($('input[name="confirmAccurate"]')).toHaveLength(0)
    expect($('.govuk-button').text().trim()).toBe('Save and continue')
    expect(
      $('h2').filter((_, element) => $(element).text() === 'Trip')
    ).toHaveLength(1)
    expect(
      groups.eq(1).find('a[href*="/species-selection"]').first().attr('href')
    ).toBe('/species-selection?return=/check-answers&gearId=dredge')
    expect(groups.eq(1).find('.govuk-visually-hidden').text()).toContain(
      'Dredge'
    )
    expect(
      (await inject('POST', '/check-answers', { confirmAccurate: 'true' }))
        .headers.location
    ).toBe('/confirmation')
  })

  test('keeps validation inputs and edits isolated to the requested gear', async () => {
    await start()
    await catchFor('pots', '38E95', '15')
    await catchFor('dredge', '38E96', '30')
    await finishTrip()
    const failed = await inject(
      'POST',
      '/species-selection?gearId=dredge&return=/check-answers',
      {
        speciesIds: SPECIES_IDS.cod,
        speciesAction: 'continue',
        [`weightAboveMinimum-${SPECIES_IDS.cod}`]: 'invalid'
      }
    )
    expect(failed.statusCode).toBe(400)
    expect(
      load(failed.result)(
        `input[name="weightAboveMinimum-${SPECIES_IDS.cod}"]`
      ).val()
    ).toBe('invalid')
    const pots = await inject('GET', '/species-selection?gearId=pots')
    expect(
      load(pots.result)(
        `input[name="weightAboveMinimum-${SPECIES_IDS.cod}"]`
      ).val()
    ).toBe('15')
    const changed = await inject(
      'POST',
      '/species-selection?gearId=dredge&return=/check-answers',
      {
        speciesIds: SPECIES_IDS.cod,
        speciesAction: 'continue',
        [`weightAboveMinimum-${SPECIES_IDS.cod}`]: '40'
      }
    )
    expect(changed.headers.location).toBe('/check-answers')
    const summary = load((await inject('GET', '/check-answers')).result)
    expect(
      summary('section[aria-labelledby^="gear-summary-"]').eq(0).text()
    ).toContain('15 kg')
    expect(
      summary('section[aria-labelledby^="gear-summary-"]').eq(1).text()
    ).toContain('40 kg')
    expect(
      (await inject('GET', '/species-selection?gearId=removed')).statusCode
    ).toBe(400)
  })

  test('blocks incomplete review and submission and collects newly added gears', async () => {
    await start(['pots'])
    expect((await inject('GET', '/check-answers')).headers.location).toBe(
      '/statistical-area?gearId=pots'
    )
    expect(
      (await inject('POST', '/check-answers', { confirmAccurate: 'true' }))
        .headers.location
    ).toBe('/statistical-area?gearId=pots')
    await catchFor('pots', '38E95', '15')
    await finishTrip()
    const added = await inject(
      'POST',
      '/gear-selection?return=/check-answers',
      {
        gearIds: ['pots', 'dredge'],
        potsHauled: '7',
        potsInWater: '5'
      }
    )
    expect(added.headers.location).toBe('/statistical-area?gearId=dredge')
    expect(
      load((await inject('GET', '/species-selection?gearId=pots')).result)(
        `input[name="weightAboveMinimum-${SPECIES_IDS.cod}"]`
      ).val()
    ).toBe('15')
    await catchFor('dredge', '38E96', '30')
    const removed = await inject(
      'POST',
      '/gear-selection?return=/check-answers',
      { gearIds: 'dredge' }
    )
    expect(removed.headers.location).toBe('/check-answers')
    expect(
      load((await inject('GET', '/check-answers')).result)(
        'section[aria-labelledby^="gear-summary-"]'
      )
    ).toHaveLength(1)
    expect(
      (await inject('GET', '/statistical-area?gearId=pots')).statusCode
    ).toBe(400)
  })

  test('keeps the Other and not-landed dependent edit journeys scoped', async () => {
    await start(['pots'])
    await catchFor('pots', '38E95', '15')
    await finishTrip()
    const other = await inject(
      'POST',
      '/statistical-area?gearId=pots&return=/check-answers',
      { statisticalArea: 'other' }
    )
    expect(other.headers.location).toBe(
      '/statistical-area-other?gearId=pots&return=/check-answers'
    )
    const area = await inject('POST', other.headers.location, {
      statisticalArea: 'other',
      alternativeStatisticalArea: '38E96'
    })
    expect(area.headers.location).toBe('/check-answers')
    const yes = await inject(
      'POST',
      '/catch-not-landed?return=/check-answers',
      { catchNotLanded: 'yes' }
    )
    expect(yes.headers.location).toBe(
      '/species-not-landed?return=/check-answers'
    )
    const kept = await inject('POST', yes.headers.location, {
      speciesIds: SPECIES_IDS.cod,
      [`weightAboveMinimum-${SPECIES_IDS.cod}`]: '2'
    })
    expect(kept.headers.location).toBe('/check-answers')
  })

  test('loops through three gears with blank next-gear answers and restores previous-gear navigation', async () => {
    await start(['pots', 'dredge', 'seine-nets'])
    expect((await catchFor('pots', '38E95', '15')).headers.location).toBe(
      '/statistical-area?gearId=dredge'
    )
    const dredgeArea = load(
      (await inject('GET', '/statistical-area?gearId=dredge')).result
    )
    expect(dredgeArea('.govuk-back-link').attr('href')).toBe(
      '/species-selection?gearId=pots'
    )
    expect(
      dredgeArea('[data-statistical-area-map]').attr('data-selected-area')
    ).toBe('')
    const dredgeSpecies = load(
      (await inject('GET', '/species-selection?gearId=dredge')).result
    )
    expect(dredgeSpecies('h1').text()).toContain('Dredge')
    expect(dredgeSpecies('a[hreflang="cy"]').attr('href')).toBe(
      '/species-selection?gearId=dredge&lang=cy'
    )
    expect(dredgeSpecies('input[type="checkbox"]:checked')).toHaveLength(0)
    expect((await catchFor('dredge', '38E96', '30')).headers.location).toBe(
      '/statistical-area?gearId=seine-nets'
    )
    expect((await catchFor('seine-nets', '38E95', '45')).headers.location).toBe(
      '/catch-not-landed'
    )
    const unlanded = load((await inject('GET', '/catch-not-landed')).result)
    expect(unlanded('.govuk-back-link').attr('href')).toBe(
      '/species-selection?gearId=seine-nets'
    )
    await finishTrip()
    const summary = load((await inject('GET', '/check-answers')).result)
    expect(summary('section[aria-labelledby^="gear-summary-"]')).toHaveLength(3)
    expect(summary('.govuk-back-link').attr('href')).toBe('/catch-not-landed')
  })

  test('keeps the add-species edit detour scoped and removes vessel species from every gear', async () => {
    await start()
    await catchFor('pots', '38E95', '15')
    await catchFor('dredge', '38E96', '30')
    await finishTrip()
    const page = load(
      (
        await inject(
          'GET',
          '/species-selection?gearId=dredge&return=/check-answers'
        )
      ).result
    )
    const addHref = page('a')
      .filter((_, element) => page(element).text() === 'Add species')
      .attr('href')
    const added = await inject('POST', addHref, { species: 'Herring (HER)' })
    expect(added.headers.location).toBe(
      '/species-selection?gearId=dredge&return=/check-answers'
    )
    const restored = load((await inject('GET', added.headers.location)).result)
    expect(restored(`input[value="${SPECIES_IDS.herring}"]`)).toHaveLength(1)
    expect(
      restored(`input[name="weightAboveMinimum-${SPECIES_IDS.cod}"]`).val()
    ).toBe('30')
    const removed = await inject(
      'POST',
      '/remove-species?gearId=dredge&return=/check-answers',
      { speciesIds: SPECIES_IDS.cod }
    )
    expect(removed.headers.location).toBe(
      '/species-selection?gearId=dredge&return=/check-answers'
    )
    for (const gearId of ['pots', 'dredge']) {
      const selection = load(
        (await inject('GET', `/species-selection?gearId=${gearId}`)).result
      )
      expect(selection(`input[value="${SPECIES_IDS.cod}"]`)).toHaveLength(0)
    }
    expect((await inject('GET', '/check-answers')).headers.location).toBe(
      '/species-selection?gearId=pots'
    )
  })

  test('offers only caught species for not-landed answers and clears them when changed to No', async () => {
    await start(['pots'])
    await catchFor('pots', '38E95', '15')
    const yes = await inject('POST', '/catch-not-landed', {
      catchNotLanded: 'yes'
    })
    const page = load((await inject('GET', yes.headers.location)).result)
    expect(page(`input[value="${SPECIES_IDS.cod}"]`)).toHaveLength(1)
    expect(page(`input[value="${SPECIES_IDS.haddock}"]`)).toHaveLength(0)
    await inject('POST', yes.headers.location, {
      speciesIds: SPECIES_IDS.cod,
      [`weightAboveMinimum-${SPECIES_IDS.cod}`]: '3'
    })
    const no = await inject('POST', '/catch-not-landed?return=/check-answers', {
      catchNotLanded: 'no'
    })
    expect(no.headers.location).toBe('/check-answers')
    const summary = load((await inject('GET', '/check-answers')).result)
    expect(
      summary('section[aria-labelledby^="gear-summary-"]').text()
    ).not.toContain('kept onboard')
    const radios = load((await inject('GET', '/catch-not-landed')).result)
    expect(radios('input[value="no"]').attr('checked')).toBeDefined()
  })

  test('removes a favourite gear and its trip answers without affecting another gear', async () => {
    await start()
    await catchFor('pots', '38E95', '15')
    await catchFor('dredge', '38E96', '30')
    await finishTrip()
    const response = await inject('POST', '/remove-gear', { gearIds: 'pots' })
    expect(response.headers.location).toBe('/gear-selection')
    const summary = load((await inject('GET', '/check-answers')).result)
    const groups = summary('section[aria-labelledby^="gear-summary-"]')
    expect(groups).toHaveLength(1)
    expect(groups.find('h2').text()).toBe('Dredge')
    expect(groups.text()).toContain('30 kg')
    expect(groups.text()).not.toContain('15 kg')
  })

  test('offers the union of caught species once and retains shared unlanded answers when another gear still caught them', async () => {
    await start()
    await catchFor('pots', '38E95', '15')
    await inject('POST', '/statistical-area?gearId=dredge', {
      statisticalArea: '38E96'
    })
    const last = await inject('POST', '/species-selection?gearId=dredge', {
      speciesIds: SPECIES_IDS.haddock,
      speciesAction: 'continue',
      [`weightAboveMinimum-${SPECIES_IDS.haddock}`]: '30'
    })
    expect(last.headers.location).toBe('/catch-not-landed')
    await inject('POST', '/catch-not-landed', { catchNotLanded: 'yes' })
    const page = load((await inject('GET', '/species-not-landed')).result)
    expect(page(`input[value="${SPECIES_IDS.cod}"]`)).toHaveLength(1)
    expect(page(`input[value="${SPECIES_IDS.haddock}"]`)).toHaveLength(1)
    expect(page(`input[value="${SPECIES_IDS.mackerel}"]`)).toHaveLength(0)
    await inject('POST', '/species-not-landed', {
      speciesIds: SPECIES_IDS.cod,
      [`weightAboveMinimum-${SPECIES_IDS.cod}`]: '3'
    })
    const changed = await inject(
      'POST',
      '/species-selection?gearId=dredge&return=/check-answers',
      {
        speciesIds: SPECIES_IDS.haddock,
        speciesAction: 'continue',
        [`weightAboveMinimum-${SPECIES_IDS.haddock}`]: '40'
      }
    )
    expect(changed.headers.location).toBe('/check-answers')
    const summary = load((await inject('GET', '/check-answers')).result)
    expect(
      summary('dt:contains("Weight kept onboard")').next().text().trim()
    ).toBe('3 kg')
    const removed = await inject(
      'POST',
      '/species-selection?gearId=pots&return=/check-answers',
      {
        speciesIds: SPECIES_IDS.haddock,
        speciesAction: 'continue',
        [`weightAboveMinimum-${SPECIES_IDS.haddock}`]: '20'
      }
    )
    expect(removed.headers.location).toBe('/species-not-landed')
    const restored = load((await inject('GET', '/species-not-landed')).result)
    expect(restored(`input[value="${SPECIES_IDS.cod}"]`)).toHaveLength(0)
  })
})
