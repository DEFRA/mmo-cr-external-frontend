import { load } from 'cheerio'
import { createServer } from '#/server/server.js'
import {
  mockPortsReferenceData,
  restorePortsReferenceDataMock
} from '#/test-helpers/mock-ports-reference-data.js'

beforeEach(() => mockPortsReferenceData())
afterEach(() => restorePortsReferenceDataMock())

describe('#signOutController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to the signed-out landing page', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/sign-out'
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/signed-out')
  })

  test('Should reject a GET request (sign out is a state change, POST-only)', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/sign-out'
    })

    expect(statusCode).toBe(404)
  })

  test('Should ignore an arbitrary query string and always redirect to the confirmation page', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/sign-out?return=https://evil.example'
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/signed-out')
  })

  test('Should clear the signed-in flag so Account is guarded again', async () => {
    const signInResponse = await server.inject({
      method: 'POST',
      url: '/sign-in'
    })
    const cookie = signInResponse.headers['set-cookie'][0].split(';')[0]

    const signOutResponse = await server.inject({
      method: 'POST',
      url: '/sign-out',
      headers: { cookie }
    })
    const signOutCookie = signOutResponse.headers['set-cookie'][0].split(';')[0]

    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/account',
      headers: { cookie: signOutCookie }
    })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe('/sign-in')
  })

  test('Should clear the in-progress catch-record journey state', async () => {
    const tripDateResponse = await server.inject({
      method: 'POST',
      url: '/trip-date',
      payload: { tripSameDate: 'yes' }
    })
    const cookie = tripDateResponse.headers['set-cookie'][0].split(';')[0]

    const signOutResponse = await server.inject({
      method: 'POST',
      url: '/sign-out',
      headers: { cookie }
    })
    const signOutCookie = signOutResponse.headers['set-cookie'][0].split(';')[0]

    const favouriteResponse = await server.inject({
      method: 'POST',
      url: '/departure-port',
      payload: { departurePort: 'hastings' },
      headers: { cookie: signOutCookie }
    })
    const favouriteCookie =
      favouriteResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/departure-port',
      headers: { cookie: favouriteCookie }
    })
    const $ = load(result)

    expect(
      $('[data-testid="app-page-navigation-back-link"]').attr('href')
    ).toBe('/trip-date')
  })

  test('Should behave safely on a repeated sign-out request', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/sign-out'
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/signed-out')
  })

  test('Should show the signed-out confirmation with feedback and a Sign in button', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/signed-out'
    })
    const $ = load(result)

    expect(statusCode).toBe(200)
    expect($('h1').text().trim()).toBe('You have been signed out')
    expect($('title').text()).toContain('You have been signed out |')
    expect($('main p').text()).toContain('This is a new service')
    expect($('main a.govuk-link').text()).toBe('feedback')
    expect($('.govuk-button').text().trim()).toBe('Sign in')
    expect($('.govuk-button').attr('href')).toBe('/sign-in')
    expect($('.govuk-back-link')).toHaveLength(0)
    expect($('.govuk-service-navigation__list')).toHaveLength(0)
    expect($('.govuk-phase-banner')).toHaveLength(1)
    expect($('.govuk-footer')).toHaveLength(1)
  })

  test('Should allow signing in again after following the sign-out confirmation', async () => {
    const signedIn = await server.inject({ method: 'POST', url: '/sign-in' })
    let cookie = signedIn.headers['set-cookie'][0].split(';')[0]
    const signedOut = await server.inject({
      method: 'POST',
      url: '/sign-out',
      headers: { cookie }
    })
    cookie = signedOut.headers['set-cookie'][0].split(';')[0]
    const confirmation = await server.inject({
      method: 'GET',
      url: signedOut.headers.location,
      headers: { cookie }
    })
    const signInHref = load(confirmation.result)('.govuk-button').attr('href')
    const signInPage = await server.inject({
      method: 'GET',
      url: signInHref,
      headers: { cookie }
    })

    expect(signInPage.statusCode).toBe(200)
    expect(load(signInPage.result)('h1').text().trim()).toBe('Sign in')
  })
})
