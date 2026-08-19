import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#tripDateController', () => {
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
      url: '/trip-date'
    })

    expect(result).toEqual(
      expect.stringContaining('Did you leave and return on the same date? |')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })
})

describe('#tripDateSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to departure port when Yes', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/trip-date',
      payload: { tripSameDate: 'yes' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/departure-port')
  })

  test('Should redirect to trip departure date when No', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/trip-date',
      payload: { tripSameDate: 'no' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/trip-departure-date')
  })

  test('Should reject an invalid choice', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/trip-date',
      payload: { tripSameDate: 'maybe' }
    })

    expect(statusCode).toBe(statusCodes.badRequest)
  })
})
