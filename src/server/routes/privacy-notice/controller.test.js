import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#privacyNoticeController', () => {
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
      url: '/privacy-notice'
    })

    expect(result).toEqual(expect.stringContaining('Privacy notice |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should render the Back link to the guidance page', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/privacy-notice'
    })

    expect(result).toEqual(
      expect.stringContaining('app-page-navigation-back-link')
    )
    expect(result).toEqual(expect.stringContaining('href="/"'))
  })
})
