import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#gearSelectionController', () => {
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
      url: '/gear-selection'
    })

    expect(result).toEqual(expect.stringContaining('Select your gear |'))
    expect(statusCode).toBe(statusCodes.ok)
  })
})

describe('#gearSelectionSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to pots details when pots is selected', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearType: 'pots' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/pots-details')
  })

  test('Should redirect to the Empty Page for any other gear', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearType: 'nets' }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/not-implemented?return=/gear-selection')
  })

  test('Should reject an empty gear type', async () => {
    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/gear-selection',
      payload: { gearType: '' }
    })

    expect(statusCode).toBe(statusCodes.badRequest)
  })
})
