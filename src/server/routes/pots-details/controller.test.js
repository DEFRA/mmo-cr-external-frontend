import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#potsDetailsController', () => {
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
      url: '/pots-details'
    })

    expect(result).toEqual(expect.stringContaining('Pots details |'))
    expect(statusCode).toBe(statusCodes.ok)
  })
})

describe('#potsDetailsSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to the statistical area page', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/pots-details'
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/statistical-area')
  })
})
