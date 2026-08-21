import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#editCatchRecordReviewController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  async function cookieWithReasonSubmitted(recordId) {
    const response = await server.inject({
      method: 'POST',
      url: `/records/${recordId}/edit-reason`,
      payload: { editReason: 'Corrected the recorded weight' }
    })
    return response.headers['set-cookie'][0].split(';')[0]
  }

  test('Should redirect to the reason page when no reason has been submitted', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/records/submitted-1/edit-review'
    })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe('/records/submitted-1/edit-reason')
  })

  test('Should render the review page once a reason has been submitted', async () => {
    const cookie = await cookieWithReasonSubmitted('submitted-1')

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/records/submitted-1/edit-review',
      headers: { cookie }
    })

    expect(result).toEqual(expect.stringContaining('Catch record for OLGA |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the amendment notification, reference and heading', async () => {
    const cookie = await cookieWithReasonSubmitted('submitted-1')

    const { result } = await server.inject({
      method: 'GET',
      url: '/records/submitted-1/edit-review',
      headers: { cookie }
    })
    const $ = load(result)
    const notificationText = $('.govuk-notification-banner__content')
      .text()
      .replace(/\s+/g, ' ')
      .trim()

    expect(notificationText).toContain('Catch record submitted:')
    expect(notificationText).toContain('22 July 2026 01:35')
    expect(notificationText).toContain('Submitted by:')
    expect(notificationText).toContain('John Smith')
    expect($('[data-testid="app-edit-review-caption"]').text().trim()).toBe(
      'A1234520260727150815'
    )
    expect($('h1').text().trim()).toBe('Catch record for OLGA')
  })

  test('Should reuse the same summary sections and data as Check Your Answers', async () => {
    const cookie = await cookieWithReasonSubmitted('submitted-1')

    const { result } = await server.inject({
      method: 'GET',
      url: '/records/submitted-1/edit-review',
      headers: { cookie }
    })
    const $ = load(result)

    expect(
      $('h2.govuk-heading-l')
        .map((_, el) => $(el).text().trim())
        .get()
    ).toEqual([
      'Trips details',
      'Gear used',
      'Species caught',
      'Species not landed'
    ])
    const bodyText = $('body').text()
    expect(bodyText).toContain('22 July 2026')
    expect(bodyText).toContain('38E95')
    expect(bodyText).toContain('Atlantic cod')
    expect(bodyText).toContain('15 kg')
  })

  test('Should point every Change link to the amendment placeholder destination', async () => {
    const cookie = await cookieWithReasonSubmitted('submitted-1')

    const { result } = await server.inject({
      method: 'GET',
      url: '/records/submitted-1/edit-review',
      headers: { cookie }
    })
    const $ = load(result)
    const changeLinks = $('a').filter((_, el) =>
      $(el).text().trim().startsWith('Change')
    )

    expect(changeLinks.length).toBeGreaterThan(0)
    changeLinks.each((_, el) => {
      expect($(el).attr('href')).toBe('/not-implemented?return=/records')
    })
  })

  test('Should not render a Change link for the Vessel row, matching the design', async () => {
    const cookie = await cookieWithReasonSubmitted('submitted-1')

    const { result } = await server.inject({
      method: 'GET',
      url: '/records/submitted-1/edit-review',
      headers: { cookie }
    })
    const $ = load(result)
    const vesselRow = $('.govuk-summary-list__row').filter(
      (_, el) =>
        $(el).find('.govuk-summary-list__key').text().trim() === 'Vessel'
    )

    expect(vesselRow.find('a').length).toBe(0)
  })

  test('Should not render the create-mode duplicate heading before the button', async () => {
    const cookie = await cookieWithReasonSubmitted('submitted-1')

    const { result } = await server.inject({
      method: 'GET',
      url: '/records/submitted-1/edit-review',
      headers: { cookie }
    })
    const $ = load(result)

    expect(
      $('h2.govuk-heading-l')
        .map((_, el) => $(el).text().trim())
        .get()
    ).not.toContain('Trips details Trips details')
    expect($('.govuk-button').text().trim()).toBe(
      'Accept and submit trip details'
    )
  })

  test('Should 404 for an unknown record', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/records/unknown-1/edit-review'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })
})

describe('#editCatchRecordReviewSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  async function cookieWithReasonSubmitted(recordId) {
    const response = await server.inject({
      method: 'POST',
      url: `/records/${recordId}/edit-reason`,
      payload: { editReason: 'Corrected the recorded weight' }
    })
    return response.headers['set-cookie'][0].split(';')[0]
  }

  test('Should redirect to Confirmation when the declaration is confirmed', async () => {
    const cookie = await cookieWithReasonSubmitted('submitted-1')

    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/records/submitted-1/edit-review',
      payload: { confirmAccurate: 'true' },
      headers: { cookie }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/confirmation')
  })

  test('Should re-render with an accessible error when the declaration is not confirmed', async () => {
    const cookie = await cookieWithReasonSubmitted('submitted-1')

    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/records/submitted-1/edit-review',
      payload: {},
      headers: { cookie }
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
    expect($('.govuk-error-summary').text()).toContain(
      'Select I confirm the information is complete and accurate'
    )
  })

  test('Should redirect to the reason page when POSTing without a valid amendment session', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/records/submitted-1/edit-review',
      payload: { confirmAccurate: 'true' }
    })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe('/records/submitted-1/edit-reason')
  })

  test('Should redirect to the reason page when the amendment session is for a different record', async () => {
    const cookie = await cookieWithReasonSubmitted('amended-1')

    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/records/submitted-1/edit-review',
      payload: { confirmAccurate: 'true' },
      headers: { cookie }
    })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe('/records/submitted-1/edit-reason')
  })

  test('Should redirect to the reason page when an invalid declaration payload has no valid amendment session', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/records/submitted-1/edit-review',
      payload: {}
    })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe('/records/submitted-1/edit-reason')
  })

  test('Should clear the amendment session so the review page requires the reason again', async () => {
    const cookie = await cookieWithReasonSubmitted('submitted-1')

    const submitResponse = await server.inject({
      method: 'POST',
      url: '/records/submitted-1/edit-review',
      payload: { confirmAccurate: 'true' },
      headers: { cookie }
    })
    const submitCookie = submitResponse.headers['set-cookie'][0].split(';')[0]

    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/records/submitted-1/edit-review',
      headers: { cookie: submitCookie }
    })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe('/records/submitted-1/edit-reason')
  })

  test('Should 404 for an unknown record on submit', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/records/unknown-1/edit-review',
      payload: { confirmAccurate: 'true' }
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })
})
