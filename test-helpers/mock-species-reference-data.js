import { config } from '#/config/config.js'

let originalToken

export const SPECIES_IDS = {
  cod: '00000000-0000-4000-8000-000000000041',
  haddock: '00000000-0000-4000-8000-000000000042',
  mackerel: '00000000-0000-4000-8000-000000000043',
  herring: '00000000-0000-4000-8000-000000000044'
}

export const SPECIES_ITEMS = [
  {
    id: SPECIES_IDS.cod,
    faoCode: 'COD',
    scientificName: 'Gadus morhua',
    displayName: 'Atlantic cod'
  },
  {
    id: SPECIES_IDS.haddock,
    faoCode: 'HAD',
    scientificName: 'Melanogrammus aeglefinus',
    displayName: 'Haddock'
  },
  {
    id: SPECIES_IDS.mackerel,
    faoCode: 'MAC',
    scientificName: 'Scomber scombrus',
    displayName: 'Mackerel'
  },
  {
    id: SPECIES_IDS.herring,
    faoCode: 'HER',
    scientificName: 'Clupea harengus',
    displayName: 'Herring'
  }
]

export function mockSpeciesReferenceData() {
  originalToken = config.get('referenceData.token')
  config.set('referenceData.token', 'test-reference-data-token')

  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => '"species-test-v1"' },
    json: async () => ({ items: SPECIES_ITEMS })
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export function restoreSpeciesReferenceDataMock() {
  vi.unstubAllGlobals()
  config.set('referenceData.token', originalToken)
}
