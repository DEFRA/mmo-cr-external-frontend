import { createServer } from '#/server/server.js'

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
    expect(headers.location).toBe('/')
  })

  test('Should reject a GET request (sign out is a state change, POST-only)', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/sign-out'
    })

    expect(statusCode).toBe(404)
  })

  test('Should ignore an arbitrary query string and always redirect to /', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/sign-out?return=https://evil.example'
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/')
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

    const { result } = await server.inject({
      method: 'GET',
      url: '/departure-port',
      headers: { cookie: signOutCookie }
    })
    const { load } = await import('cheerio')
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
    expect(headers.location).toBe('/')
  })
})
