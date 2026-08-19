import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#statisticalAreaController', () => {
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
      url: '/statistical-area'
    })

    expect(result).toEqual(expect.stringContaining('Statistical area |'))
    expect(statusCode).toBe(statusCodes.ok)
  })
})

describe('#statisticalAreaSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to species selection when a named area is chosen', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      payload: { statisticalArea: 'area-viid' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/species-selection')
  })

  test('Should redirect to the alternative statistical area page when Other is chosen', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      payload: { statisticalArea: 'other' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/statistical-area-other')
  })

  test('Should reject an empty statistical area', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/statistical-area',
      payload: { statisticalArea: '' }
    })

    expect(statusCode).toBe(statusCodes.badRequest)
  })
})
