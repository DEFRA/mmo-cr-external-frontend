import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#returnPortController', () => {
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
      url: '/return-port'
    })

    expect(result).toEqual(expect.stringContaining('Return port |'))
    expect(statusCode).toBe(statusCodes.ok)
  })
})

describe('#returnPortSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to the gear selection page', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/return-port'
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/gear-selection')
  })
})
