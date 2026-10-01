import { config } from '#/config/config.js'

export const VESSEL_IDS = {
  achilles: '00000000-0000-4000-8000-000000000011',
  seaSpray: '00000000-0000-4000-8000-000000000012'
}

const vessels = [
  {
    id: VESSEL_IDS.achilles,
    name: 'ACHILLES',
    pln: 'PH1234',
    cfr: 'GBR000A1234',
    displayName: 'ACHILLES PH1234',
    lengthOverallMetres: 8.74
  },
  {
    id: VESSEL_IDS.seaSpray,
    name: 'SEA SPRAY',
    pln: 'BM45',
    cfr: 'GBR000B5678',
    displayName: 'SEA SPRAY BM45',
    lengthOverallMetres: 11.2
  }
]

let originalToken

export function mockVesselsReferenceData() {
  originalToken = config.get('referenceData.token')
  config.set('referenceData.token', 'test-reference-data-token')
  const previousFetch = globalThis.fetch
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options) => {
      const parsed = new URL(url)
      if (parsed.pathname === '/api/v1/reference-data/vessels') {
        const offset = Number(parsed.searchParams.get('offset'))
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => '"vessels-test-v1"' },
          json: async () => ({
            items: vessels.slice(offset),
            total: vessels.length,
            offset,
            limit: 50,
            version: 'test-v1'
          })
        })
      }
      if (parsed.pathname.startsWith('/api/v1/reference-data/vessels/')) {
        const item = vessels.find(
          (vessel) => vessel.id === parsed.pathname.split('/').at(-1)
        )
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

export function restoreVesselsReferenceDataMock() {
  vi.unstubAllGlobals()
  config.set('referenceData.token', originalToken)
}
