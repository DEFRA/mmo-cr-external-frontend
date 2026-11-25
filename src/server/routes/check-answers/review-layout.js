import {
  KEPT_WEIGHT,
  NOT_LANDED,
  STATISTICAL_AREA_LABEL,
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
    key: { text: `${label} (kg)` },
    value: { text: weight },
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

function reviewTripRows(base, context) {
  const labels = [
    ['Vessel', 'Vessel'],
    ['Departure date', 'Date left'],
    ['Departure port', 'Port left from'],
    ['Return date', 'Date returned'],
    ['Return port', 'Port returned to']
  ]
  const rows = labels.map(([source, label]) => {
    const row = base.sections[0].rows.find((item) => item.key.text === source)
    if (source === 'Vessel') {
      return { key: row.key, value: row.value }
    }
    return relabelRow(row, label)
  })
  const gearNames = base.gearGroups.map((group) => group.heading)
  if (gearNames.length) {
    rows.push({
      key: { text: 'Gear used' },
      value: {
        text: gearNames.join(', '),
        html: gearNames.map(escapeHtml).join('<br>')
      },
      actions: {
        items: [
          {
            href: context.buildChangeHref('/gear-selection'),
            text: 'Change',
            visuallyHiddenText: 'gear used'
          }
        ]
      }
    })
  }
  return rows
}

function relabelRow(row, label) {
  return {
    ...row,
    key: { text: label },
    actions: {
      items: row.actions.items.map((item) => ({
        ...item,
        visuallyHiddenText: label.toLowerCase()
      }))
    }
  }
}

const MEASUREMENT_LABELS = {
  'Total pots or traps hauled':
    'Total number of pots or traps hauled during the trip',
  'Total pots or traps left in water':
    'Total number of pots or traps left in the water at the end of the trip',
  'Number of times shot': 'Number of times gear was shot on the trip',
  'Mesh size': 'Mesh size (mm)'
}

function reviewMeasurementLabel(row) {
  const label = MEASUREMENT_LABELS[row.key.text]
  if (!label) {
    return row
  }
  const value =
    label === 'Mesh size (mm)'
      ? { text: row.value.text.replaceAll(/\s*mm\b/g, '') }
      : row.value
  return { ...row, key: { text: label }, value }
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
        Number(second.key.text.startsWith('Number of times')) -
        Number(first.key.text.startsWith('Number of times'))
    )
  return [
    ...rows,
    ...measurements.map((row) =>
      reviewMeasurementLabel(reviewMeasurementRow(row, group.gearId, context))
    )
  ]
}

function reviewTrailingRow(row) {
  if (row.key.text === NOT_LANDED) {
    return relabelRow(row, 'Catch kept onboard or in keep pots')
  }
  if (row.key.text === KEPT_WEIGHT) {
    return {
      ...row,
      key: {
        text: 'Weight above minimum size kept onboard or in keep pots (kg)'
      },
      value: { text: stripKilogramSuffix(row.value.text) }
    }
  }
  return row
}

function reviewTrailingSections(sections) {
  return sections.map((section) => ({
    ...section,
    heading: '4. Species not landed',
    rows: section.rows.map(reviewTrailingRow)
  }))
}

export function buildReviewLayout(base, context) {
  const speciesGroups = base.gearGroups.flatMap((group) =>
    reviewSpeciesGroups(group, context.speciesCatalogue)
  )
  const headingCounts = Map.groupBy(speciesGroups, (group) => group.heading)
  return {
    sections: [
      { heading: '1. Trips details', rows: reviewTripRows(base, context) }
    ],
    gearGroups: base.gearGroups.map((group) => ({
      ...group,
      rows: reviewGearRows(group, context, speciesGroups)
    })),
    speciesGroups: speciesGroups.map((group) => ({
      ...group,
      // Only name the gear when the same species was caught with more than one gear
      showGear: headingCounts.get(group.heading).length > 1
    })),
    trailingSections: reviewTrailingSections(base.trailingSections)
  }
}
