import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#editCatchRecordReasonController', () => {
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
      url: '/records/submitted-1/edit-reason'
    })

    expect(result).toEqual(
      expect.stringContaining('Why are you editing this catch record? |')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the notification, reference, heading, textarea and button', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/records/submitted-1/edit-reason'
    })
    const $ = load(result)

    expect(
      $('.govuk-notification-banner__heading')
        .text()
        .replace(/\s+/g, ' ')
        .trim()
    ).toBe(
      'This catch record was submitted for a trip that ended on 22 July 2026.'
    )
    expect($('[data-testid="app-edit-reason-caption"]').text().trim()).toBe(
      'A1234520260727150815'
    )
    expect($('h1').text().trim()).toBe('Why are you editing this catch record?')
    expect($('textarea#editReason')).toHaveLength(1)
    expect($('.govuk-button').text().trim()).toBe('Save and continue')
  })

  test('Should render the Back link to Catch Record Details for the selected record', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/records/submitted-1/edit-reason'
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/records/submitted-1')
  })

  test('Should 404 for an unknown record', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/records/unknown-1/edit-reason'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })
})

describe('#editCatchRecordReasonSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to Editing catch record on a valid reason', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/records/submitted-1/edit-reason',
      payload: { editReason: 'Corrected the recorded weight' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/records/submitted-1/edit-review')
  })

  test('Should re-render with an accessible error when the reason is missing', async () => {
    const { statusCode, result } = await server.inject({
      method: 'POST',
      url: '/records/submitted-1/edit-reason',
      payload: {}
    })
    const $ = load(result)

    expect(statusCode).toBe(statusCodes.badRequest)
    expect($('.govuk-error-summary')).toHaveLength(1)
    expect($('.govuk-error-summary').text()).toContain(
      'Enter the reason for editing this catch record'
    )
    expect($('.govuk-error-message')).toHaveLength(1)
  })

  test('Should reject a reason longer than the maximum length', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/records/submitted-1/edit-reason',
      payload: { editReason: 'a'.repeat(2001) }
    })

    expect(statusCode).toBe(statusCodes.badRequest)
  })

  test('Should 404 for an unknown record on submit', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/records/unknown-1/edit-reason',
      payload: { editReason: 'A reason' }
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('Should not place the reason in the redirect query string', async () => {
    const { headers } = await server.inject({
      method: 'POST',
      url: '/records/submitted-1/edit-reason',
      payload: { editReason: 'Corrected the recorded weight' }
    })

    expect(headers.location).not.toContain('Corrected')
    expect(headers.location).not.toContain('?')
  })
})
