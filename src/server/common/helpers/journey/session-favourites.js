import Boom from '@hapi/boom'
import { getJourneyState, setJourneyState } from './navigation.js'
import { catchRecordService, liveCatchRecords } from './catch-record-service.js'
import { getPortCatalogue, portSearchLabel } from '../ports/ports-list.js'

function vesselInput(request) {
  const vesselId = getJourneyState(request).selectedVesselId
  if (!vesselId) {
    throw Boom.badRequest('Select a vessel before managing its favourites', {
      catchRecordError: true
    })
  }
  return { ...catchRecordService(), vesselId }
}

export async function loadFavouriteGears(request) {
  if (!liveCatchRecords()) return getJourneyState(request)
  const state = getJourneyState(request)
  if (!state.selectedVesselId) {
    return setJourneyState(request, {
      favouriteGearIds: [],
      favouriteGearMeasurements: {}
    })
  }
  const { client, ...input } = vesselInput(request)
  const result = await client.listFavouriteGears(input)
  return setJourneyState(request, {
    favouriteGearIds: result.favouriteGearIds,
    favouriteGearMeasurements: state.favouriteGearMeasurements ?? {}
  })
}

export async function addFavouriteGear(request, id) {
  if (!liveCatchRecords()) return
  const { client, ...input } = vesselInput(request)
  const result = await client.addFavouriteGear({ ...input, gearId: id })
  return setJourneyState(request, {
    favouriteGearIds: result.favouriteGearIds
  })
}

export async function removeFavouriteGears(request, ids) {
  if (!liveCatchRecords()) return
  const { client, ...input } = vesselInput(request)
  for (const gearId of ids) {
    await client.removeFavouriteGear({ ...input, gearId })
  }
  const state = await loadFavouriteGears(request)
  return setJourneyState(request, {
    favouriteGearMeasurements: Object.fromEntries(
      Object.entries(state.favouriteGearMeasurements).filter(
        ([id]) => !ids.includes(id)
      )
    )
  })
}

export async function loadFavouriteSpecies(request) {
  if (!liveCatchRecords()) return getJourneyState(request)
  const state = getJourneyState(request)
  const { client, ...input } = state.selectedVesselId
    ? vesselInput(request)
    : {}
  const ids = client
    ? (await client.listFavouriteSpecies(input)).favouriteSpeciesIds
    : []
  return setJourneyState(request, {
    favouriteSpeciesIds: ids,
    availableSpeciesIds: ids
  })
}

export async function addFavouriteSpecies(request, id) {
  if (!liveCatchRecords()) return
  const { client, ...input } = vesselInput(request)
  const result = await client.addFavouriteSpecies({ ...input, speciesId: id })
  return setJourneyState(request, {
    favouriteSpeciesIds: result.favouriteSpeciesIds,
    availableSpeciesIds: result.favouriteSpeciesIds
  })
}

export async function removeFavouriteSpecies(request, ids) {
  if (!liveCatchRecords()) return
  const { client, ...input } = vesselInput(request)
  for (const speciesId of ids) {
    await client.removeFavouriteSpecies({ ...input, speciesId })
  }
  return loadFavouriteSpecies(request)
}

function storePorts(request, ids, catalogue) {
  const ports = ids.map((id) => catalogue.find((port) => port.id === id))
  if (ports.some((port) => !port)) {
    throw Boom.conflict(
      'A favourite port is no longer available in Reference Data. Reload the page before trying again.',
      { catchRecordError: true }
    )
  }
  return setJourneyState(request, {
    favouritePortIds: ids,
    favouritePorts: ports.map((port) => port.code),
    accountPortsUsed: ports.map((port) => portSearchLabel(port, catalogue))
  })
}

export async function loadFavouritePorts(request, catalogue) {
  if (!liveCatchRecords()) return getJourneyState(request)
  const ports = catalogue ?? (await getPortCatalogue())
  const vesselId = getJourneyState(request).selectedVesselId
  const { client, ...input } = vesselId ? vesselInput(request) : {}
  return storePorts(
    request,
    client ? (await client.listFavouritePorts(input)).favouritePortIds : [],
    ports
  )
}

export async function addFavouritePort(request, id, catalogue) {
  if (!liveCatchRecords()) return
  const { client, ...input } = vesselInput(request)
  const result = await client.addFavouritePort({ ...input, portId: id })
  return storePorts(request, result.favouritePortIds, catalogue)
}

export async function removeFavouritePorts(request, ids, catalogue) {
  if (!liveCatchRecords()) return
  const { client, ...input } = vesselInput(request)
  for (const portId of ids) {
    await client.removeFavouritePort({ ...input, portId })
  }
  return loadFavouritePorts(request, catalogue)
}
