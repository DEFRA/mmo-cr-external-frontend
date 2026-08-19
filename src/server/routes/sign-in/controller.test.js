import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#signInController', () => {
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
      url: '/sign-in'
    })

    expect(result).toEqual(expect.stringContaining('Sign in |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should link the unsupported actions to the Empty Page with a return path', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/sign-in'
    })
    const $ = load(result)

    expect(
      $('a[href="/not-implemented?return=/sign-in"]')
    ).toHaveLength(2)
  })
})

describe('#signInSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to the records list', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/sign-in'
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/records')
  })
})
