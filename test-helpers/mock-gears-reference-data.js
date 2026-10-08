import { config } from '#/config/config.js'
import { getData } from '#/server/common/data/get-data.js'

const catalogue = getData('gearCatalogue')
const measurements = [
  ...new Map(
    catalogue
      .flatMap((gear) => gear.measurements || [])
      .map((measurement) => [measurement.id, measurement])
  ).values()
].map((measurement, index) => ({
  id: measurement.id,
  code: measurement.id.toUpperCase(),
  label: measurement.label,
  kind: 'number',
  unit: null,
  minimumValue: 0,
  maximumValue: null,
  index
}))
const gears = catalogue.map((gear) => ({
  id: gear.id,
  code: gear.code || gear.id.toUpperCase(),
  name: gear.label,
  category: { id: 'test-category', code: 'TEST', name: 'Fishing gear' },
  pairFishing: false,
  requiredMeasurementIds: [],
  variableMeasurementIds: (gear.measurements || []).map(({ id }) => id)
}))

let previousFetch
let originalToken

export function mockGearsReferenceData() {
  previousFetch = globalThis.fetch
  originalToken = config.get('referenceData.token')
  config.set('referenceData.token', 'test-reference-data-token')
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options) => {
      const parsed = new URL(url)
      if (parsed.pathname === '/api/v1/reference-data/gears') {
        const offset = Number(parsed.searchParams.get('offset'))
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => `"gears-test-${offset}"` },
          json: async () => ({
            items: gears.slice(offset),
            measurements,
            total: gears.length,
            offset,
            limit: 500,
            version: 'test-v1'
          })
        })
      }
      if (parsed.pathname.startsWith('/api/v1/reference-data/gears/')) {
        const gear = gears.find(
          (item) => item.id === parsed.pathname.split('/').at(-1)
        )
        return Promise.resolve({
          ok: Boolean(gear),
          status: gear ? 200 : 404,
          json: async () => gear
        })
      }
      return previousFetch(url, options)
    })
  )
}

export function restoreGearsReferenceDataMock() {
  vi.stubGlobal('fetch', previousFetch)
  config.set('referenceData.token', originalToken)
}
