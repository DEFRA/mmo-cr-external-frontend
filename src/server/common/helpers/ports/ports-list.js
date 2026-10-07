import Boom from '@hapi/boom'

import { config } from '#/config/config.js'
import { createPortsReferenceDataClient } from '#/server/common/clients/ports-reference-data.js'
import {
  getJourneyState,
  setJourneyState
} from '#/server/common/helpers/journey/navigation.js'

const client = createPortsReferenceDataClient({
  serviceUrl: config.get('referenceData.serviceUrl'),
  token: () => config.get('referenceData.token'),
  timeoutMs: config.get('referenceData.timeoutMs')
})

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function getPortCatalogue() {
  try {
    return await client.getPorts()
  } catch {
    throw Boom.serverUnavailable(
      'Ports reference data is temporarily unavailable'
    )
  }
}

export async function getPortItem(id) {
  try {
    return await client.getPort(id)
  } catch {
    throw Boom.serverUnavailable(
      'Ports reference data is temporarily unavailable'
    )
  }
}

export function findPortByCode(code, catalogue) {
  const exact = catalogue.find((port) => port.code === code)
  if (exact) {
    return exact
  }

  const legacyMatches = catalogue.filter((port) => slugify(port.name) === code)
  return legacyMatches.length === 1 ? legacyMatches[0] : undefined
}

export function findPortByName(name, catalogue) {
  const matches = catalogue.filter(
    (port) =>
      portSearchLabel(port, catalogue).toLowerCase() ===
      name.trim().toLowerCase()
  )
  return matches.length === 1 ? matches[0] : undefined
}

export function portSearchLabel(port, catalogue) {
  const duplicates = catalogue.filter(
    (candidate) => candidate.name.toLowerCase() === port.name.toLowerCase()
  )
  return duplicates.length > 1 ? `${port.name} (${port.code})` : port.name
}

export function migratePortJourneyState(request, catalogue) {
  const state = getJourneyState(request)
  const patch = {}
  const portNamesByCode = { ...state.portNamesByCode }
  const portCoordinatesByCode = { ...state.portCoordinatesByCode }
  const canonicalCode = (code) => findPortByCode(code, catalogue)?.code || code

  if (Array.isArray(state.favouritePorts)) {
    const codes = [...new Set(state.favouritePorts.map(canonicalCode))]
    if (JSON.stringify(codes) !== JSON.stringify(state.favouritePorts)) {
      patch.favouritePorts = codes
    }
  }

  for (const key of ['departurePort', 'returnPort']) {
    const port = findPortByCode(state[key], catalogue)
    if (!port) continue
    if (port.code !== state[key]) patch[key] = port.code
    if (portNamesByCode[port.code] !== port.name) {
      portNamesByCode[port.code] = port.name
    }
    const coordinate = coordinateTuple(port.coordinate)
    if (coordinate && !portCoordinatesByCode[port.code]) {
      portCoordinatesByCode[port.code] = coordinate
    }
  }

  if (
    Object.keys(portNamesByCode).length !==
      Object.keys(state.portNamesByCode || {}).length ||
    Object.entries(portNamesByCode).some(
      ([code, name]) => state.portNamesByCode?.[code] !== name
    )
  ) {
    patch.portNamesByCode = portNamesByCode
  }
  if (
    Object.keys(portCoordinatesByCode).length !==
    Object.keys(state.portCoordinatesByCode || {}).length
  ) {
    patch.portCoordinatesByCode = portCoordinatesByCode
  }

  return Object.keys(patch).length ? setJourneyState(request, patch) : state
}

export function rememberPortName(request, port) {
  const state = getJourneyState(request)
  const coordinate = coordinateTuple(port.coordinate)
  setJourneyState(request, {
    portNamesByCode: { ...state.portNamesByCode, [port.code]: port.name },
    ...(coordinate && {
      portCoordinatesByCode: {
        ...state.portCoordinatesByCode,
        [port.code]: coordinate
      }
    })
  })
}

function coordinateTuple(coordinate) {
  if (
    !Number.isFinite(coordinate?.longitude) ||
    !Number.isFinite(coordinate?.latitude)
  ) {
    return undefined
  }
  return [coordinate.longitude, coordinate.latitude]
}
