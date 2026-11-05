import { RETRIEVED_DRAFT } from './mock-catch-recording.js'

export function canonicalCatchRecord(overrides = {}) {
  return {
    ...structuredClone(RETRIEVED_DRAFT),
    version: 5,
    numberOfSubmissions: 0,
    vessel: {
      id: 'vessel-1',
      nameSnapshot: 'TEST VESSEL',
      rssSnapshot: 'RSS1'
    },
    trip: {
      startedAndFinishedToday: false,
      dateStarted: '2026-06-01',
      dateEnded: '2026-06-02',
      departurePort: {
        id: 'port-1',
        codeSnapshot: 'GBABC',
        nameSnapshot: 'Test port'
      },
      returnPort: {
        id: 'port-1',
        codeSnapshot: 'GBABC',
        nameSnapshot: 'Test port'
      }
    },
    pairFishing: { enabled: false },
    gears: [
      {
        associationId: '00000000-0000-4000-8000-000000000201',
        gear: { id: 'gear-1', codeSnapshot: 'GEAR', nameSnapshot: 'Test gear' },
        characteristics: [
          {
            characteristicId: 'measurement-1',
            nameSnapshot: 'Length',
            value: 12
          }
        ],
        statisticalArea: {
          id: 'area-1',
          codeSnapshot: '30E5',
          nameSnapshot: '30E5'
        },
        speciesCaught: [
          {
            id: 'species-1',
            faoCodeSnapshot: 'COD',
            nameSnapshot: 'Cod',
            weightAboveMinimumKg: 12.5,
            weightBelowMinimumKg: 0,
            weightLegallyDiscardedKg: 0,
            weightPrecision: 'oneDecimalPlace'
          }
        ]
      }
    ],
    speciesNotLanded: [
      { id: 'species-1', nameSnapshot: 'Cod', weightAboveMinimumKg: 1 }
    ],
    ...overrides
  }
}
