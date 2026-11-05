import { canonicalCatchRecord } from '#/test-helpers/canonical-catch-record.js'
import {
  recordJourney,
  tripPayload,
  gearPayload,
  speciesPayload
} from './catch-record-mapping.js'

const catalogue = [
  {
    id: 'gear-1',
    measurements: [{ id: 'measurement-1' }]
  }
]

describe('Canonical catch record mapping', () => {
  test('Should hydrate trip references and answers without turning them into user favourites', () => {
    const state = recordJourney(canonicalCatchRecord())
    expect(state).toMatchObject({
      version: 5,
      selectedVesselId: 'vessel-1',
      departurePort: 'GBABC',
      gearAssociationIds: { 'gear-1': '00000000-0000-4000-8000-000000000201' },
      gearMeasurementDetails: { 'gear-1': { 'measurement-1': 12 } },
      catchDetailsByGearId: {
        'gear-1': {
          selectedStatisticalArea: '30E5',
          selectedSpeciesIds: ['species-1']
        }
      }
    })
    expect(state).not.toHaveProperty('favouriteGearIds')
    expect(state).not.toHaveProperty('availableSpeciesIds')
  })

  test('Should round-trip client-owned gear selections without snapshot fields', () => {
    const state = recordJourney(canonicalCatchRecord())
    expect(gearPayload(state, catalogue, { '30E5': 'area-1' })).toEqual([
      {
        associationId: '00000000-0000-4000-8000-000000000201',
        gear: { id: 'gear-1' },
        characteristics: [{ characteristicId: 'measurement-1', value: 12 }],
        statisticalArea: { id: 'area-1' },
        speciesCaught: [
          {
            id: 'species-1',
            weightAboveMinimumKg: 12.5,
            weightBelowMinimumKg: 0,
            weightLegallyDiscardedKg: 0,
            weightPrecision: 'oneDecimalPlace'
          }
        ]
      }
    ])
    expect(speciesPayload(state.speciesNotLanded)).toEqual([
      { id: 'species-1', weightAboveMinimumKg: 1 }
    ])
  })

  test('Should map ports to authoritative IDs and use the provided same-day date', () => {
    const state = recordJourney(canonicalCatchRecord())
    const ports = [{ id: 'port-1', code: 'GBABC' }]
    expect(tripPayload(state, ports, '2026-06-03')).toEqual({
      startedAndFinishedToday: false,
      dateStarted: '2026-06-01',
      dateEnded: '2026-06-02',
      departurePort: { id: 'port-1' },
      returnPort: { id: 'port-1' }
    })
    expect(tripPayload({ tripSameDate: true }, [], '2026-06-03')).toEqual({
      startedAndFinishedToday: true,
      dateStarted: '2026-06-03',
      dateEnded: '2026-06-03'
    })
  })

  test('Should support partial drafts and explicit area clearing', () => {
    expect(tripPayload({}, [], '2026-06-03')).toEqual({})
    expect(speciesPayload()).toEqual([])
    expect(gearPayload({}, [], {})).toEqual([])
    const state = {
      selectedGearIds: ['gear-1'],
      gearAssociationIds: { 'gear-1': 'association-1' }
    }
    expect(gearPayload(state, catalogue, {})[0].statisticalArea).toBeNull()
  })

  test('Should preserve the recorded dates when editing a previous same-day trip', () => {
    const state = recordJourney(
      canonicalCatchRecord({
        trip: {
          startedAndFinishedToday: true,
          dateStarted: '2026-06-01',
          dateEnded: '2026-06-01'
        }
      })
    )
    expect(tripPayload(state, [], '2026-06-03')).toEqual({
      startedAndFinishedToday: false,
      dateStarted: '2026-06-01',
      dateEnded: '2026-06-01'
    })
  })

  test('Should omit association IDs for gears not yet saved by the backend', () => {
    const state = { selectedGearIds: ['gear-1'] }
    expect(gearPayload(state, catalogue, {})[0]).not.toHaveProperty(
      'associationId'
    )
  })
  test('Should reject unresolved ports, gear, measurements and statistical areas', () => {
    expect(() => tripPayload({ departurePort: 'unknown' }, [], '')).toThrow(
      'Select an available port'
    )
    const state = recordJourney(canonicalCatchRecord())
    expect(() => gearPayload(state, [], {})).toThrow('Select an available gear')
    expect(() =>
      gearPayload(state, [{ id: 'gear-1', measurements: [] }], {})
    ).toThrow('Select an available gear measurement')
    expect(() => gearPayload(state, catalogue, {})).toThrow(
      'Select a statistical area'
    )
  })

  test('Should reject repeated gear types instead of silently losing associations', () => {
    const record = canonicalCatchRecord()
    record.gears.push({
      ...record.gears[0],
      associationId: 'second-association'
    })
    expect(() => recordJourney(record)).toThrow('repeated gear types')
  })
})
