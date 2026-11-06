import Boom from '@hapi/boom'

function fieldsWithValues(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  )
}

function portReference(ports, code) {
  if (!code) {
    return undefined
  }
  const port = ports.find((item) => item.code === code || item.id === code)
  if (!port) {
    throw Boom.badRequest('Select an available port')
  }
  return { id: port.id }
}

export function tripPayload(state, ports, today) {
  const sameDay =
    state.tripSameDate === true &&
    (!state.departureDate || state.departureDate === today)
  return fieldsWithValues({
    startedAndFinishedToday:
      state.tripSameDate === true ? sameDay : state.tripSameDate,
    dateStarted: sameDay ? today : state.departureDate,
    dateEnded: sameDay ? today : state.returnDate,
    departurePort: portReference(ports, state.departurePort),
    returnPort: portReference(ports, state.returnPort)
  })
}

export function speciesPayload(entries) {
  return Object.entries(entries || {}).map(([id, weights]) =>
    fieldsWithValues({
      id,
      weightAboveMinimumKg: weights.weightAboveMinimum,
      weightBelowMinimumKg: weights.weightBelowMinimum,
      weightLegallyDiscardedKg: weights.weightDiscarded,
      weightPrecision: weights.weightPrecision
    })
  )
}

export function statisticalAreaCode(answers) {
  if (answers.statAreaBranch !== 'other') {
    return answers.selectedStatisticalArea
  }
  return answers.selectedAlternativeAreaOption === 'other'
    ? answers.alternativeStatisticalArea
    : answers.selectedAlternativeAreaOption
}

function measurementDefinition(gear, measurementId) {
  const definition = gear.measurements.find(
    (measurement) => measurement.id === measurementId
  )
  if (definition) {
    return definition
  }
  if (gear.id === 'pots') {
    return gear.measurements[measurementId === 'potsHauled' ? 0 : 1]
  }
  return undefined
}

function gearCharacteristics(state, gear) {
  const measurements = {
    ...state.gearMeasurementDetails?.[gear.id],
    ...(gear.id === 'pots' ? state.potsDetails : {})
  }
  return Object.entries(measurements)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([measurementId, value]) => {
      const definition = measurementDefinition(gear, measurementId)
      if (!definition) {
        throw Boom.badRequest('Select an available gear measurement')
      }
      return { characteristicId: definition.id, value }
    })
}

function gearStatisticalArea(answers, areaIds) {
  const code = statisticalAreaCode(answers)
  if (!code || code === 'other') {
    return null
  }
  const areaId = areaIds[code.toUpperCase()]
  if (!areaId) {
    throw Boom.badRequest(
      'Select a statistical area available from the Reference Data Service',
      { catchRecordError: true }
    )
  }
  return { id: areaId }
}

export function gearPayload(state, catalogue, areaIds) {
  return (state.selectedGearIds || []).map((id) => {
    const gear = catalogue.find((item) => item.id === id)
    if (!gear) {
      throw Boom.badRequest('Select an available gear')
    }
    const answers = state.catchDetailsByGearId?.[id] || {}
    const characteristics = gearCharacteristics(state, gear)
    const statisticalArea = gearStatisticalArea(answers, areaIds)
    return {
      ...(state.gearAssociationIds?.[id]
        ? { associationId: state.gearAssociationIds[id] }
        : {}),
      gear: { id },
      characteristics,
      statisticalArea,
      speciesCaught: speciesPayload(
        Object.fromEntries(
          (answers.selectedSpeciesIds || []).map((speciesId) => [
            speciesId,
            answers.speciesWeights?.[speciesId] || {}
          ])
        )
      )
    }
  })
}

function assertUniqueGears(gears) {
  if (new Set(gears.map((entry) => entry.gear.id)).size !== gears.length) {
    throw Boom.conflict(
      'This record contains repeated gear types and cannot be edited in the web journey',
      { catchRecordError: true }
    )
  }
}

function portNames(trip) {
  const portNamesByCode = {}
  for (const port of [trip.departurePort, trip.returnPort]) {
    if (port) {
      portNamesByCode[port.codeSnapshot] = port.nameSnapshot
    }
  }
  return portNamesByCode
}

function journeyWeights(entry) {
  return fieldsWithValues({
    weightAboveMinimum: entry.weightAboveMinimumKg,
    weightBelowMinimum: entry.weightBelowMinimumKg,
    weightDiscarded: entry.weightLegallyDiscardedKg,
    weightPrecision: entry.weightPrecision
  })
}

function speciesWeightsById(species) {
  return Object.fromEntries(
    species.map((item) => [item.id, journeyWeights(item)])
  )
}

function gearJourney(gears) {
  const byGearId = (value) =>
    Object.fromEntries(gears.map((entry) => [entry.gear.id, value(entry)]))
  return {
    selectedGearIds: gears.map((entry) => entry.gear.id),
    gearAssociationIds: byGearId((entry) => entry.associationId),
    gearLabelsById: byGearId((entry) => entry.gear.nameSnapshot),
    gearMeasurementDetails: byGearId((entry) =>
      Object.fromEntries(
        entry.characteristics.map((item) => [item.characteristicId, item.value])
      )
    ),
    catchDetailsByGearId: byGearId((entry) => ({
      statAreaBranch: 'direct',
      selectedStatisticalArea: entry.statisticalArea?.codeSnapshot,
      selectedSpeciesIds: entry.speciesCaught.map((species) => species.id),
      speciesWeights: speciesWeightsById(entry.speciesCaught)
    }))
  }
}

export function recordJourney(record) {
  assertUniqueGears(record.gears)
  return {
    catchRecordId: record.id,
    reference: record.catchRecordReference,
    version: record.version,
    selectedVesselId: record.vessel.id,
    draftVesselId: record.vessel.id,
    selectedVesselName: record.vessel.nameSnapshot,
    selectedVesselLengthOverallMetres:
      record.vessel.lengthOverallMetresSnapshot,
    tripSameDate: record.trip.startedAndFinishedToday,
    departureDate: record.trip.dateStarted,
    returnDate: record.trip.dateEnded,
    departurePort: record.trip.departurePort?.codeSnapshot,
    returnPort: record.trip.returnPort?.codeSnapshot,
    portNamesByCode: portNames(record.trip),
    pairFishing: record.pairFishing,
    ...gearJourney(record.gears),
    catchNotLanded: record.speciesNotLanded.length > 0,
    speciesNotLanded: speciesWeightsById(record.speciesNotLanded)
  }
}
