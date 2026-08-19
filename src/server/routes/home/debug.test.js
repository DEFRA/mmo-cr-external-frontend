import { createServer } from '#/server/server.js'

describe('debug', () => {
  test('dump', async () => {
    const server = await createServer()
    await server.initialize()
    const { result } = await server.inject({ method: 'GET', url: '/' })
    console.log(result)
    await server.stop({ timeout: 0 })
  })
})
