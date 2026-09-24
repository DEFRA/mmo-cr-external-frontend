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

  test('Should link the Personal details Change actions to their dedicated pages', async () => {
    const cookie = await signedInCookie()

    const { result } = await server.inject({
      method: 'GET',
      url: '/account',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('a[href="/change-email"]').text().trim()).toContain('Change')
    expect($('a[href="/reset-password"]').text().trim()).toContain('Change')
    expect($('a[href="/change-vessel-owner"]').text().trim()).toContain(
      'Change'
    )
    expect($('a[href="/change-address"]').text().trim()).toContain('Change')
    expect($('a[href="/change-contact-number"]').text().trim()).toContain(
      'Change'
    )
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

  test('Should link Add port to the add-port journey and Remove port to the remove-port page', async () => {
    const cookie = await signedInCookie()
    const { result } = await server.inject({
      method: 'GET',
      url: '/account',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('a[href="/add-port?for=departure&return=/account"]')).toHaveLength(
      1
    )
    expect($('a[href="/remove-port"]')).toHaveLength(1)
  })

  test('Should reflect a port removal on the account page', async () => {
    const signInCookie = await signedInCookie()
    const removeResponse = await server.inject({
      method: 'POST',
      url: '/remove-port',
      headers: { cookie: signInCookie },
      payload: { ports: 'Hastings' }
    })
    expect(removeResponse.headers.location).toBe('/account')
    const cookie = removeResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/account',
      headers: { cookie }
    })
    const $ = load(result)
    const portsRow = $('.govuk-summary-list__row').filter(
      (_, row) => $(row).find('dt').text().trim() === 'Ports used'
    )

    expect(portsRow.find('.govuk-summary-list__value').text().trim()).toBe('')
  })

  test('Should link Add gear and Remove gear to the gear journey with a return path', async () => {
    const cookie = await signedInCookie()
    const { result } = await server.inject({
      method: 'GET',
      url: '/account',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('a[href="/add-gear?return=/account"]')).toHaveLength(1)
    expect($('a[href="/remove-gear?return=/account"]')).toHaveLength(1)
  })

  test('Should link Add species and Remove species to the species journey with a return path', async () => {
    const cookie = await signedInCookie()
    const { result } = await server.inject({
      method: 'GET',
      url: '/account',
      headers: { cookie }
    })
    const $ = load(result)

    expect($('a[href="/add-species?return=/account"]')).toHaveLength(1)
    expect($('a[href="/remove-species?return=/account"]')).toHaveLength(1)
  })

  test('Should reflect a gear removal on the account page', async () => {
    const signInCookie = await signedInCookie()
    const removeResponse = await server.inject({
      method: 'POST',
      url: '/remove-gear?return=/account',
      headers: { cookie: signInCookie },
      payload: { gearIds: 'pots' }
    })
    expect(removeResponse.headers.location).toBe('/account')
    const cookie = removeResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/account',
      headers: { cookie }
    })

    expect(result).not.toContain('Pots')
    expect(result).toContain('Beam trawl')
  })

  test('Should reflect a species removal on the account page', async () => {
    const signInCookie = await signedInCookie()
    const removeResponse = await server.inject({
      method: 'POST',
      url: '/remove-species?return=/account',
      headers: { cookie: signInCookie },
      payload: { speciesIds: 'cod' }
    })
    expect(removeResponse.headers.location).toBe('/account')
    const cookie = removeResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/account',
      headers: { cookie }
    })

    expect(result).not.toContain('Atlantic cod (COD)')
    expect(result).toContain('Haddock (HAD)')
  })

  test('Should show the named, escaped skipper once one has been added', async () => {
    const signInCookie = await signedInCookie()
    const skipperResponse = await server.inject({
      method: 'POST',
      url: '/skipper-details',
      headers: { cookie: signInCookie },
      payload: {
        firstName: 'Jane <script>',
        lastName: "O'Doe",
        email: 'jane.doe@example.com'
      }
    })
    const cookie = skipperResponse.headers['set-cookie'][0].split(';')[0]

    const { result } = await server.inject({
      method: 'GET',
      url: '/account',
      headers: { cookie }
    })
    const $ = load(result)
    const skippersRow = $('.govuk-summary-list__row').filter(
      (_, row) => $(row).find('dt').text().trim() === 'Skippers'
    )

    expect(result).toContain('Jane &lt;script&gt; O&#39;Doe')
    expect(skippersRow.find('.govuk-summary-list__value').text().trim()).toBe(
      "Jane <script> O'Doe"
    )
  })
})
