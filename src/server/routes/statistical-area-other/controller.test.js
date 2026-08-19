import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#statisticalAreaOtherController', () => {
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
      url: '/statistical-area-other'
    })

    expect(result).toEqual(
      expect.stringContaining('Alternative statistical area |')
    )
    expect(statusCode).toBe(statusCodes.ok)
  })
})

describe('#statisticalAreaOtherSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to the species selection page', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/statistical-area-other'
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/species-selection')
  })
})
