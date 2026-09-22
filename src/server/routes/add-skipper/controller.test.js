import { load } from 'cheerio'
import { createServer } from '#/server/server.js'

describe('Add skipper journey', () => {
  let server
  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })
  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })
  async function cookie() {
    const response = await server.inject({ method: 'POST', url: '/sign-in' })
    return response.headers['set-cookie'][0].split(';')[0]
  }

  test('Should render the decision page and validate a missing answer', async () => {
    const signedInCookie = await cookie()
    const response = await server.inject({
      method: 'GET',
      url: '/add-skipper',
      headers: { cookie: signedInCookie }
    })
    expect(load(response.result)('h1').text()).toContain(
      'Do you want to add a skipper'
    )
    const invalid = await server.inject({
      method: 'POST',
      url: '/add-skipper',
      headers: { cookie: signedInCookie },
      payload: {}
    })
    expect(invalid.statusCode).toBe(400)
    expect(load(invalid.result)('.govuk-error-summary')).toHaveLength(1)
  })

  test('Should route Yes to details and No back to account', async () => {
    const signedInCookie = await cookie()
    const yes = await server.inject({
      method: 'POST',
      url: '/add-skipper',
      headers: { cookie: signedInCookie },
      payload: { wantsToAddSkipper: 'yes' }
    })
    expect(yes.headers.location).toBe('/skipper-details')
    const no = await server.inject({
      method: 'POST',
      url: '/add-skipper',
      headers: { cookie: signedInCookie },
      payload: { wantsToAddSkipper: 'no' }
    })
    expect(no.headers.location).toBe('/account')
  })

  test('Should validate skipper details and continue to review', async () => {
    const signedInCookie = await cookie()
    const invalid = await server.inject({
      method: 'POST',
      url: '/skipper-details',
      headers: { cookie: signedInCookie },
      payload: { firstName: '', lastName: '', email: 'bad' }
    })
    expect(invalid.statusCode).toBe(400)
    expect(load(invalid.result)('.govuk-error-summary')).toHaveLength(1)
    const valid = await server.inject({
      method: 'POST',
      url: '/skipper-details',
      headers: { cookie: signedInCookie },
      payload: {
        firstName: 'Anthony',
        lastName: 'Jones',
        email: 'anthony.jones@email.com'
      }
    })
    expect(valid.headers.location).toBe('/skipper-check')
  })

  test('Should validate review confirmation and show confirmation page', async () => {
    const signedInCookie = await cookie()
    await server.inject({
      method: 'POST',
      url: '/skipper-details',
      headers: { cookie: signedInCookie },
      payload: {
        firstName: 'Anthony',
        lastName: 'Jones',
        email: 'anthony.jones@email.com'
      }
    })
    const invalid = await server.inject({
      method: 'POST',
      url: '/skipper-check',
      headers: { cookie: signedInCookie },
      payload: {}
    })
    expect(invalid.statusCode).toBe(400)
    const valid = await server.inject({
      method: 'POST',
      url: '/skipper-check',
      headers: { cookie: signedInCookie },
      payload: { confirmSkipper: 'true' }
    })
    expect(valid.headers.location).toBe('/skipper-confirmation')
    const confirmation = await server.inject({
      method: 'GET',
      url: '/skipper-confirmation',
      headers: { cookie: signedInCookie }
    })
    expect(confirmation.statusCode).toBe(200)
    expect(confirmation.result).toContain('Skipper added for vessel OLGA')
  })
})
