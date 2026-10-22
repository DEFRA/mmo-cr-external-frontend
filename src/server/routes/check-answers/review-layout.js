import {
  NOT_LANDED,
  STATISTICAL_AREA_LABEL,
  stripKilogramSuffix,
  toSummaryListRow
} from './summary-sections.js'

function weightFieldForLabel(label) {
  if (label.startsWith('Weight above')) {
    return 'weightAboveMinimum'
  }
  if (label.startsWith('Weight below')) {
    return 'weightBelowMinimum'
  }
  return 'weightDiscarded'
}

function reviewWeightRow(row, speciesGroup) {
  const label = row.key.text
    .replace(/ \([A-Z]+\)$/, '')
    .replace('Weight legally discard', 'Weight legally discarded')
  const weightField = weightFieldForLabel(row.key.text)
  const { speciesId } = speciesGroup
  return {
    ...row,
    key: { text: `${label} (kg)` },
    value: { text: stripKilogramSuffix(row.value.text) },
    actions: {
      items: row.actions.items.map((item) => ({
        ...item,
        href: speciesId ? `${item.href}#${weightField}-${speciesId}` : item.href
      }))
    }
  }
}

function reviewSpeciesGroups(group, speciesCatalogue) {
  const speciesGroups = []
  for (const row of group.rows) {
    if (row.key.text.startsWith('Species')) {
      speciesGroups.push({
        heading: row.value.text,
        speciesId: speciesCatalogue.find(
          (species) => species.text === row.value.text
        )?.id,
        gearId: group.gearId,
        gearHeading: group.heading,
        rows: []
      })
    } else if (row.key.text.startsWith('Weight') && speciesGroups.length) {
      const speciesGroup = speciesGroups.at(-1)
      speciesGroup.rows.push(reviewWeightRow(row, speciesGroup))
    }
  }
  return speciesGroups
}

function reviewTripRows(base, context) {
  const labels = [
    ['Vessel', 'Vessel'],
    ['Departure date', 'Date left'],
    ['Departure port', 'Port left from'],
    ['Return date', 'Date returned'],
    ['Return port', 'Port returned to']
  ]
  const rows = labels.map(([original, label]) => ({
    ...base.sections[0].rows.find((row) => row.key.text === original),
    key: { text: label }
  }))
  const gearUsed = toSummaryListRow({
    key: 'Gear used',
    value: '',
    changeHref: context.buildChangeHref('/gear-selection')
  })
  gearUsed.value = { items: base.gearGroups.map((group) => group.heading) }
  return [...rows, gearUsed]
}

function reviewMeasurementRow(row, gearId, context) {
  const measurement = context.gearCatalogue
    .find((gear) => gear.id === gearId)
    ?.measurements?.find((item) => item.label === row.key.text)
  const potsFields = {
    'Total pots or traps hauled': 'potsHauled',
    'Total pots or traps left in water': 'potsInWater'
  }
  let field = potsFields[row.key.text]
  if (!field && measurement) {
    field = `${gearId}-${measurement.id}`
  }
  if (!field) {
    return row
  }
  return {
    ...row,
    actions: {
      items: row.actions.items.map((item) => ({
        ...item,
        href: `${item.href}#${field}`
      }))
    }
  }
}

function reviewGearRows(group, context, speciesGroups) {
  const area = group.rows.find((row) => row.key.text === STATISTICAL_AREA_LABEL)
  const selectedSpecies = group.rows.find((row) =>
    row.key.text.startsWith('Species')
  )
  const rows = []
  if (area) {
    rows.push({ ...area, key: { text: 'Area majority catch caught' } })
  }
  if (selectedSpecies) {
    rows.push({
      ...selectedSpecies,
      key: { text: 'Species caught' },
      value: {
        items: speciesGroups
          .filter((item) => item.gearId === group.gearId)
          .map((item) => item.heading)
      }
    })
  }
  const measurements = group.rows
    .filter(
      (row) =>
        row !== area &&
        row.key.text !== 'Gear' &&
        !row.key.text.startsWith('Species') &&
        !row.key.text.startsWith('Weight')
    )
    .toSorted(
      (first, second) =>
        Number(second.key.text.startsWith('Number of times gear')) -
        Number(first.key.text.startsWith('Number of times gear'))
    )
  return [
    ...rows,
    ...measurements.map((row) =>
      reviewMeasurementRow(row, group.gearId, context)
    )
  ]
}

function reviewTrailingSections(sections) {
  return sections.map((section) => ({
    ...section,
    heading: '4. Species not landed',
    rows: section.rows.map((row) =>
      row.key.text === NOT_LANDED
        ? { ...row, key: { text: 'Catch kept onboard or in keep pots' } }
        : row
    )
  }))
}

export function buildReviewLayout(base, context) {
  const speciesGroups = base.gearGroups.flatMap((group) =>
    reviewSpeciesGroups(group, context.speciesCatalogue)
  )
  return {
    sections: [
      { heading: '1. Trips details', rows: reviewTripRows(base, context) }
    ],
    gearGroups: base.gearGroups.map((group) => ({
      ...group,
      rows: reviewGearRows(group, context, speciesGroups)
    })),
    speciesGroups,
    trailingSections: reviewTrailingSections(base.trailingSections)
  }
}
