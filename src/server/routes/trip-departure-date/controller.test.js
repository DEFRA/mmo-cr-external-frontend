import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#tripDepartureDateController', () => {
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
      url: '/trip-departure-date'
    })

    expect(result).toEqual(expect.stringContaining('When did you leave? |'))
    expect(statusCode).toBe(statusCodes.ok)
  })
})

describe('#tripDepartureDateSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to the trip return date page', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/trip-departure-date'
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/trip-return-date')
  })
})
