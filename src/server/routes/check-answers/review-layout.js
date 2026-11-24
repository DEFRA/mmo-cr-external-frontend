import {
  KEPT_WEIGHT,
  STATISTICAL_AREA_LABEL,
  STATISTICAL_SUB_AREA,
  stripKilogramSuffix
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

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function reviewWeightRow(row, speciesGroup) {
  const label = row.key.text
    .replace(/ \([A-Z]+\)$/, '')
    .replace('Weight legally discard', 'Weight legally discarded')
  const weightField = weightFieldForLabel(row.key.text)
  const { speciesId } = speciesGroup
  const weight = stripKilogramSuffix(row.value.text).trim()
  return {
    ...row,
    key: { text: label },
    value: { text: weight ? `${weight} kg` : '' },
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
      const species = speciesCatalogue.find(
        (item) => item.text === row.value.text
      )
      speciesGroups.push({
        heading: row.value.text,
        speciesId: species?.id,
        gearId: group.gearId,
        gearHeading: group.heading,
        rows: []
      })
      continue
    }
    if (row.key.text.startsWith('Weight') && speciesGroups.length) {
      const speciesGroup = speciesGroups.at(-1)
      speciesGroup.rows.push(reviewWeightRow(row, speciesGroup))
    }
  }
  return speciesGroups
}

function reviewTripRows(base) {
  const labels = [
    'Vessel',
    'Departure date',
    'Return date',
    'Departure port',
    'Return port'
  ]
  return labels.map((label) => {
    const row = base.sections[0].rows.find((item) => item.key.text === label)
    if (label === 'Vessel') {
      return { key: row.key, value: row.value }
    }
    return row
  })
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

function reviewGearRows(group, context, speciesGroups, multipleGears) {
  const area = group.rows.find((row) => row.key.text === STATISTICAL_AREA_LABEL)
  const selectedSpecies = group.rows.find((row) =>
    row.key.text.startsWith('Species')
  )
  const rows = []
  if (area) {
    rows.push({
      ...area,
      key: {
        text: multipleGears ? 'Area majority caught' : STATISTICAL_SUB_AREA
      }
    })
  }
  if (selectedSpecies) {
    const speciesNames = speciesGroups
      .filter((item) => item.gearId === group.gearId)
      .map((item) => item.heading)
    rows.push({
      ...selectedSpecies,
      key: { text: 'Species caught' },
      value: {
        text: speciesNames.join(', '),
        html: speciesNames.map(escapeHtml).join('<br>')
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
    heading: 'Species not landed',
    rows: section.rows.map((row) =>
      row.key.text === KEPT_WEIGHT
        ? {
            ...row,
            key: {
              text: 'Weight above minimum size kept onboard or in keep pots (kg)'
            },
            value: { text: stripKilogramSuffix(row.value.text) }
          }
        : row
    )
  }))
}

export function buildReviewLayout(base, context) {
  const speciesGroups = base.gearGroups.flatMap((group) =>
    reviewSpeciesGroups(group, context.speciesCatalogue)
  )
  const headingCounts = Map.groupBy(speciesGroups, (group) => group.heading)
  const multipleGears = base.gearGroups.length > 1
  return {
    sections: [{ heading: 'Trips details', rows: reviewTripRows(base) }],
    gearGroups: base.gearGroups.map((group) => ({
      ...group,
      rows: reviewGearRows(group, context, speciesGroups, multipleGears)
    })),
    speciesGroups: speciesGroups.map((group) => ({
      ...group,
      // Only name the gear when the same species was caught with more than one gear
      showGear: headingCounts.get(group.heading).length > 1
    })),
    trailingSections: reviewTrailingSections(base.trailingSections)
  }
}
