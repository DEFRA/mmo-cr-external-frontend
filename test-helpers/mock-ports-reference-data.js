import { config } from '#/config/config.js'

const PORTS = [
  {
    id: '00000000-0000-4000-8000-000000000031',
    code: 'hastings',
    name: 'Hastings'
  },
  {
    id: '00000000-0000-4000-8000-000000000032',
    code: 'newhaven',
    name: 'Newhaven'
  },
  { id: '00000000-0000-4000-8000-000000000033', code: 'rye', name: 'Rye' },
  { id: '00000000-0000-4000-8000-000000000034', code: 'dover', name: 'Dover' },
  {
    id: '00000000-0000-4000-8000-000000000035',
    code: 'GBPLY',
    name: 'Plymouth'
  }
]

let originalToken

export function mockPortsReferenceData() {
  originalToken = config.get('referenceData.token')
  config.set('referenceData.token', 'test-reference-data-token')
  const previousFetch = globalThis.fetch
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options) => {
      const path = new URL(url).pathname
      if (path === '/api/v1/reference-data/ports') {
        const offset = Number(new URL(url).searchParams.get('offset'))
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => '"ports-test-v1"' },
          json: async () => ({
            items: PORTS.slice(offset),
            total: PORTS.length,
            offset,
            limit: 50,
            version: 'test-v1'
          })
        })
      }
      if (path.startsWith('/api/v1/reference-data/ports/')) {
        const item = PORTS.find((port) => port.id === path.split('/').at(-1))
        return Promise.resolve({
          ok: Boolean(item),
          status: item ? 200 : 404,
          json: async () => item
        })
      }
      return previousFetch(url, options)
    })
  )
}

export function restorePortsReferenceDataMock() {
  vi.unstubAllGlobals()
  config.set('referenceData.token', originalToken)
}
