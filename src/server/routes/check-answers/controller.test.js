import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#checkAnswersController', () => {
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
      url: '/check-answers'
    })

    expect(result).toEqual(expect.stringContaining('Check your answers |'))
    expect(statusCode).toBe(statusCodes.ok)
  })
})

describe('#checkAnswersSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to the confirmation page', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/check-answers'
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/confirmation')
  })
})
