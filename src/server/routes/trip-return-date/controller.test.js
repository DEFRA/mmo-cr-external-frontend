import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#tripReturnDateController', () => {
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
      url: '/trip-return-date'
    })

    expect(result).toEqual(expect.stringContaining('When did you return? |'))
    expect(statusCode).toBe(statusCodes.ok)
  })
})

describe('#tripReturnDateSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to the departure port page', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/trip-return-date'
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/departure-port')
  })
})
