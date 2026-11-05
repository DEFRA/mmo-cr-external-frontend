import Boom from '@hapi/boom'

function fieldsWithValues(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  )
}

export function tripPayload(state, ports, today) {
  const sameDay =
    state.tripSameDate === true &&
    (!state.departureDate || state.departureDate === today)
  function port(code) {
    if (!code) return undefined
    const item = ports.find((item) => item.code === code || item.id === code)
    if (!item) throw Boom.badRequest('Select an available port')
    return { id: item.id }
  }
  return fieldsWithValues({
    startedAndFinishedToday:
      state.tripSameDate === true ? sameDay : state.tripSameDate,
    dateStarted: sameDay ? today : state.departureDate,
    dateEnded: sameDay ? today : state.returnDate,
    departurePort: port(state.departurePort),
    returnPort: port(state.returnPort)
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

export function gearPayload(state, catalogue, areaIds) {
  return (state.selectedGearIds || []).map((id) => {
    const gear = catalogue.find((gear) => gear.id === id)
    if (!gear) throw Boom.badRequest('Select an available gear')
    const answers = state.catchDetailsByGearId?.[id] || {}
    const measurements = {
      ...state.gearMeasurementDetails?.[id],
      ...(id === 'pots' ? state.potsDetails : {})
    }
    const characteristics = Object.entries(measurements)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([measurementId, value]) => {
        const definition =
          gear.measurements.find(
            (measurement) => measurement.id === measurementId
          ) ||
          (id === 'pots'
            ? gear.measurements[measurementId === 'potsHauled' ? 0 : 1]
            : undefined)
        if (!definition) {
          throw Boom.badRequest('Select an available gear measurement')
        }
        return { characteristicId: definition.id, value }
      })
    const code =
      answers.statAreaBranch === 'other'
        ? answers.selectedAlternativeAreaOption === 'other'
          ? answers.alternativeStatisticalArea
          : answers.selectedAlternativeAreaOption
        : answers.selectedStatisticalArea
    if (code && code !== 'other' && !areaIds[code.toUpperCase()]) {
      throw Boom.badRequest(
        'Select a statistical area available from the Reference Data Service',
        { catchRecordError: true }
      )
    }
    return {
      ...(state.gearAssociationIds?.[id]
        ? { associationId: state.gearAssociationIds[id] }
        : {}),
      gear: { id },
      characteristics,
      statisticalArea:
        code && code !== 'other' ? { id: areaIds[code.toUpperCase()] } : null,
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

export function recordJourney(record) {
  if (
    new Set(record.gears.map((entry) => entry.gear.id)).size !==
    record.gears.length
  ) {
    throw Boom.conflict(
      'This record contains repeated gear types and cannot be edited in the web journey',
      { catchRecordError: true }
    )
  }
  const portNamesByCode = {}
  for (const port of [record.trip.departurePort, record.trip.returnPort]) {
    if (port) portNamesByCode[port.codeSnapshot] = port.nameSnapshot
  }
  function weights(entry) {
    return fieldsWithValues({
      weightAboveMinimum: entry.weightAboveMinimumKg,
      weightBelowMinimum: entry.weightBelowMinimumKg,
      weightDiscarded: entry.weightLegallyDiscardedKg,
      weightPrecision: entry.weightPrecision
    })
  }
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
    portNamesByCode,
    pairFishing: record.pairFishing,
    selectedGearIds: record.gears.map((entry) => entry.gear.id),
    gearAssociationIds: Object.fromEntries(
      record.gears.map((entry) => [entry.gear.id, entry.associationId])
    ),
    gearLabelsById: Object.fromEntries(
      record.gears.map((entry) => [entry.gear.id, entry.gear.nameSnapshot])
    ),
    gearMeasurementDetails: Object.fromEntries(
      record.gears.map((entry) => [
        entry.gear.id,
        Object.fromEntries(
          entry.characteristics.map((item) => [
            item.characteristicId,
            item.value
          ])
        )
      ])
    ),
    catchDetailsByGearId: Object.fromEntries(
      record.gears.map((entry) => [
        entry.gear.id,
        {
          statAreaBranch: 'direct',
          selectedStatisticalArea: entry.statisticalArea?.codeSnapshot,
          selectedSpeciesIds: entry.speciesCaught.map((species) => species.id),
          speciesWeights: Object.fromEntries(
            entry.speciesCaught.map((species) => [species.id, weights(species)])
          )
        }
      ])
    ),
    catchNotLanded: record.speciesNotLanded.length > 0,
    speciesNotLanded: Object.fromEntries(
      record.speciesNotLanded.map((species) => [species.id, weights(species)])
    )
  }
}
