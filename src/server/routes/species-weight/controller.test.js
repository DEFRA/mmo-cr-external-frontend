import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#speciesWeightController', () => {
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
      url: '/species-weight'
    })

    expect(result).toEqual(expect.stringContaining('Species weight |'))
    expect(statusCode).toBe(statusCodes.ok)
  })
})

describe('#speciesWeightSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to the catch not landed page', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/species-weight'
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/catch-not-landed')
  })
})
