const MESH_HINT_PATTERN = /^(\d+(?:\.\d+)?)\s*mm mesh$/i
const GEAR_TYPE = 'Gear type'

function joinWithAnd(items) {
  if (items.length < 2) {
    return items.join('')
  }
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function selectedGearLabel(selectedIds, catalogue, fallback) {
  if (!selectedIds) {
    return fallback.gear
  }
  return joinWithAnd(
    selectedIds
      .map((id) => {
        const gear = catalogue.find((item) => item.id === id)
        return gear?.name || gear?.label
      })
      .filter(Boolean)
  )
}

function resolveMeshSize(
  selectedIds,
  catalogue,
  potsSelected,
  meshSizeDefault
) {
  const hints = (selectedIds || [])
    .map((id) => catalogue.find((gear) => gear.id === id)?.hint)
    .map((hint) => hint?.trim().match(MESH_HINT_PATTERN)?.[1])
    .filter(Boolean)
  if (hints.length) {
    return hints.map((hint) => `${hint} mm`).join(', ')
  }
  return potsSelected ? meshSizeDefault : null
}

function potsRows(details, fallback, changeHref) {
  return [
    {
      key: 'Total pots or traps hauled',
      value: details.potsHauled ?? fallback.potsHauled,
      changeHref
    },
    {
      key: 'Total pots or traps left in water',
      value: details.potsInWater ?? fallback.potsInWater,
      changeHref
    }
  ]
}

function recordedMeasurementRows(
  state,
  gearId,
  catalogue,
  changeHref,
  compactSummary
) {
  const measurements =
    catalogue.find((gear) => gear.id === gearId)?.measurements || []
  const values = {
    ...state.favouriteGearMeasurements?.[gearId],
    ...state.gearMeasurementDetails?.[gearId]
  }
  return measurements
    .filter((measurement) => values[measurement.id] !== undefined)
    .map((measurement) => ({
      key: compactSummary
        ? compactMeasurementLabel(measurement)
        : measurement.label,
      value: values[measurement.id],
      changeHref
    }))
}

function selectedGearIds(state) {
  return Array.isArray(state.selectedGearIds) &&
    state.selectedGearIds.length > 0
    ? state.selectedGearIds
    : null
}

export function gearUsedSection(
  state,
  fallback,
  meshSizeDefault,
  buildChangeHref,
  catalogue,
  compactSummary = false
) {
  const selectedIds = selectedGearIds(state)
  const potsSelected = selectedIds ? selectedIds.includes('pots') : true
  const changeHref = buildChangeHref('/gear-selection')
  const meshSize = resolveMeshSize(
    selectedIds,
    catalogue,
    potsSelected,
    meshSizeDefault
  )
  const rows = [
    {
      key: GEAR_TYPE,
      value: selectedGearLabel(selectedIds, catalogue, fallback),
      changeHref
    }
  ]
  if (potsSelected) {
    rows.push(...potsRows(state.potsDetails || {}, fallback, changeHref))
  }
  if (meshSize) {
    rows.push({ key: 'Mesh size', value: meshSize, changeHref })
  }
  for (const gearId of state.selectedGearIds || []) {
    if (gearId !== 'pots') {
      rows.push(
        ...recordedMeasurementRows(
          state,
          gearId,
          catalogue,
          changeHref,
          compactSummary
        )
      )
    }
  }
  return { heading: 'Gear used', rows }
}

function compactMeasurementLabel(measurement) {
  const labels = {
    ME: 'Mesh size (mm)',
    MESH_SIZE: 'Mesh size (mm)',
    GN: 'Gear dimension by number',
    GM: 'Gear dimension by length or width of the gear',
    NL: 'Net length (m)',
    HE: 'Net height (m)',
    NN: 'Number of nets',
    QG: 'Quantity of gear onboard',
    NI: 'Number of lines',
    MT: 'Trawl model',
    numberOfTimesShot: 'Number of times gear was shot on the trip'
  }
  const dimensionLabel = measurement.label?.match(
    /^Gear dimension by (?:number|length or width of the gear)/
  )?.[0]
  return (
    dimensionLabel ||
    labels[measurement.code] ||
    labels[measurement.id] ||
    measurement.label
  )
}

export function gearSummaryRows(rows) {
  return rows.map((row) =>
    row.key === GEAR_TYPE ? { ...row, key: 'Gear' } : row
  )
}

export function summaryGearCatalogue(catalogue) {
  return catalogue.map((gear) =>
    gear.measurements?.some((measurement) => measurement.id === 'meshSize')
      ? { ...gear, hint: null }
      : gear
  )
}
