import Boom from '@hapi/boom'

import { config } from '#/config/config.js'
import { createGearsReferenceDataClient } from '#/server/common/clients/gears-reference-data.js'
import { getData } from '#/server/common/data/get-data.js'
import {
  getJourneyState,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'

const client = createGearsReferenceDataClient({
  serviceUrl: config.get('referenceData.serviceUrl'),
  token: () => config.get('referenceData.token'),
  timeoutMs: config.get('referenceData.timeoutMs')
})
const legacyGearCatalogue = getData('gearCatalogue')
const legacyPotsOption = legacyGearCatalogue.find((gear) => gear.id === 'pots')

function withMeasurementMessages(gear) {
  const legacy = legacyGearCatalogue.find((option) => option.id === gear.id)
  return {
    ...gear,
    measurements: gear.measurements.map((measurement) => {
      const legacyMeasurement = legacy?.measurements?.find(
        (option) => option.id === measurement.id
      )
      return {
        ...measurement,
        emptyMessage:
          legacyMeasurement?.emptyMessage ||
          `Enter the ${measurement.label.toLowerCase()}`,
        ...(legacyMeasurement?.invalidMessage && {
          invalidMessage: legacyMeasurement.invalidMessage
        })
      }
    })
  }
}

function normalized(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
}

function migratedGearId(id, catalogue) {
  if (catalogue.some((gear) => gear.id === id)) {
    return id
  }
  const legacy = legacyGearCatalogue.find((gear) => gear.id === id)
  if (!legacy) {
    return undefined
  }
  const label = normalized(legacy.label)
  const matches = catalogue.filter(
    (gear) => normalized(gear.name) === label || normalized(gear.code) === label
  )
  return matches.length === 1 ? matches[0].id : undefined
}

export async function getGearCatalogue(filters = {}) {
  try {
    const { items } = await client.getGears(filters)
    const catalogue =
      !config.get('catchRecording.enabled') &&
      legacyPotsOption &&
      !items.some(
        (gear) => gear.id === 'pots' || normalized(gear.name) === 'pots'
      )
        ? [...items, legacyPotsOption]
        : items
    return catalogue.map(withMeasurementMessages)
  } catch {
    throw Boom.serverUnavailable(
      'Gear reference data is temporarily unavailable'
    )
  }
}

export async function getGearItem(id, options) {
  try {
    return await client.getGear(id, options)
  } catch {
    throw Boom.serverUnavailable(
      'Gear reference data is temporarily unavailable'
    )
  }
}

export function getFavouriteGearIds(journeyState, catalogue) {
  const ids = Array.isArray(journeyState?.favouriteGearIds)
    ? journeyState.favouriteGearIds
    : []
  return [
    ...new Set(ids.map((id) => migratedGearId(id, catalogue)).filter(Boolean))
  ]
}

export function getFavouriteGearOptions(favouriteGearIds, catalogue) {
  const byId = new Map(catalogue.map((gear) => [gear.id, gear]))
  return favouriteGearIds.map((id) => byId.get(id)).filter(Boolean)
}

export function findGearOptionByLabel(label, catalogue) {
  const normalizedLabel = normalized(label)
  const matches = catalogue.filter(
    (gear) =>
      normalized(gear.name) === normalizedLabel ||
      normalized(gear.code) === normalizedLabel
  )
  return matches.length === 1 ? matches[0] : undefined
}

export function getGearOptionById(id, catalogue) {
  return catalogue.find((gear) => gear.id === id)
}

export function getFavouriteGearMeasurements(journeyState) {
  return journeyState?.favouriteGearMeasurements || {}
}

export function formatGearMeasurements(option, values) {
  return (option?.measurements || [])
    .filter(
      ({ id }) =>
        values?.[id] !== undefined && values[id] !== null && values[id] !== ''
    )
    .map(({ id, label }) => `${label}: ${values[id]}`)
}

function assertSelectedGearsAvailable(state, catalogue) {
  if (
    config.get('catchRecording.enabled') &&
    state.selectedGearIds?.some(
      (id) => !catalogue.some((gear) => gear.id === id)
    )
  ) {
    throw Boom.conflict(
      'A saved gear is no longer available. This record cannot be edited without changing its saved selections.',
      { catchRecordError: true }
    )
  }
}

function migratedGearIdList(ids, catalogue) {
  if (!Array.isArray(ids)) {
    return undefined
  }
  const migrated = [
    ...new Set(ids.map((id) => migratedGearId(id, catalogue)).filter(Boolean))
  ]
  const keepsSelection = migrated.length > 0 || ids.length === 0
  return keepsSelection && JSON.stringify(migrated) !== JSON.stringify(ids)
    ? migrated
    : undefined
}

function migratedGearIdKeys(values, catalogue) {
  if (!values) {
    return undefined
  }
  const migrated = Object.fromEntries(
    Object.entries(values).map(([id, value]) => [
      migratedGearId(id, catalogue) || id,
      value
    ])
  )
  return JSON.stringify(migrated) === JSON.stringify(values)
    ? undefined
    : migrated
}

export function migrateGearJourneyState(request, catalogue) {
  const state = getJourneyState(request)
  assertSelectedGearsAvailable(state, catalogue)
  const patch = {}
  for (const key of ['favouriteGearIds', 'selectedGearIds']) {
    const ids = migratedGearIdList(state[key], catalogue)
    if (ids) {
      patch[key] = ids
    }
  }
  for (const key of [
    'catchDetailsByGearId',
    'gearMeasurementDetails',
    'gearLabelsById'
  ]) {
    const migrated = migratedGearIdKeys(state[key], catalogue)
    if (migrated) {
      patch[key] = migrated
    }
  }
  return Object.keys(patch).length ? setJourneyState(request, patch) : state
}
