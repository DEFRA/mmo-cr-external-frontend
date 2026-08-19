import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#accountController', () => {
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
      url: '/account'
    })

    expect(result).toEqual(expect.stringContaining('Your account |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should link the unsupported action to the Empty Page with a return path', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/account'
    })
    const $ = load(result)

    expect($('a[href="/not-implemented?return=/account"]')).toHaveLength(1)
  })
})
