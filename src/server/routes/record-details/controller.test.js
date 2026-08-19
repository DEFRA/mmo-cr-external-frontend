import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#recordDetailsController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should render details for a submitted record', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/records/submitted-1'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining('Catch record details |')
    )
  })

  test('Should render details for an amended record', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/records/amended-1'
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render details for a late record', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/records/late-1'
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should redirect an unsent record to the draft page', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/records/unsent-1'
    })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe('/draft')
  })

  test('Should 404 for an unknown record', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/records/does-not-exist'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })
})
