import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#accountController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  async function signedInCookie() {
    const response = await server.inject({ method: 'POST', url: '/sign-in' })
    return response.headers['set-cookie'][0].split(';')[0]
  }

  test('Should redirect a signed-out request to sign in', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/account'
    })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe('/sign-in')
  })

  test('Should provide expected response when signed in', async () => {
    const cookie = await signedInCookie()

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/account',
      headers: { cookie }
    })

    expect(result).toEqual(expect.stringContaining('Your account |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render Personal details and Vessel details in order', async () => {
    const cookie = await signedInCookie()

    const { result } = await server.inject({
      method: 'GET',
      url: '/account',
      headers: { cookie }
    })
    const $ = load(result)

    expect(
      $('h2.govuk-heading-l')
        .map((_, el) => $(el).text().trim())
        .get()
    ).toEqual(['Personal details', 'Vessel details'])
    expect($('h3.govuk-heading-m').text().trim()).toBe('OLGA (FIN-126-U)')
  })

  test('Should render account values from the mock data source, not hard-coded', async () => {
    const cookie = await signedInCookie()

    const { result } = await server.inject({
      method: 'GET',
      url: '/account',
      headers: { cookie }
    })
    const $ = load(result)
    const text = $.text()

    expect(text).toContain('john.smith@email.com')
    expect(text).toContain('**********')
    expect(text).toContain('OLGA (FIN-126-U)')
    expect(text).toContain('Hastings')
    expect(text).toContain('Atlantic cod (COD)')
  })

  test('Should link every unsupported action to the Empty Page with a return path', async () => {
    const cookie = await signedInCookie()

    const { result } = await server.inject({
      method: 'GET',
      url: '/account',
      headers: { cookie }
    })
    const $ = load(result)

    expect(
      $('a[href="/not-implemented?return=/account"]').length
    ).toBeGreaterThan(0)
  })

  test('Should render the signed-in header with Home, Your account (current) and a Sign out form', async () => {
    const cookie = await signedInCookie()

    const { result } = await server.inject({
      method: 'GET',
      url: '/account',
      headers: { cookie }
    })
    const $ = load(result)
    const navLinks = $('.govuk-service-navigation__list a')

    expect(navLinks.filter('[href="/records"]')).toHaveLength(1)
    const accountLink = navLinks.filter('[href="/account"]')
    expect(accountLink).toHaveLength(1)
    expect(accountLink.attr('aria-current')).toBe('page')
    expect(
      $('.govuk-service-navigation__list form[action="/sign-out"]')
    ).toHaveLength(1)
    expect(
      $('.govuk-service-navigation__list form[method="post"] button')
        .text()
        .trim()
    ).toBe('Sign out')
  })

  test('Should render no header navigation when signed out', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/sign-in'
    })
    const $ = load(result)

    expect($('.govuk-service-navigation__list').children()).toHaveLength(0)
  })

  test('Should render View all catch records linking to Records', async () => {
    const cookie = await signedInCookie()

    const { result } = await server.inject({
      method: 'GET',
      url: '/account',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('.govuk-button').text().trim()).toBe('View all catch records')
    expect($('.govuk-button').attr('href')).toBe('/records')
  })

  test('Should link Add skipper to the skipper journey', async () => {
    const cookie = await signedInCookie()
    const { result } = await server.inject({
      method: 'GET',
      url: '/account',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('a[href="/add-skipper"]')).toHaveLength(1)
  })
})
