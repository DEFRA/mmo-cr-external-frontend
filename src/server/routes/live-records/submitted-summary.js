import { formatDate } from '#/config/nunjucks/filters/format-date.js'

const notEntered = 'Not entered'

function row(label, value) {
  return { key: { text: label }, value: { text: value ?? notEntered } }
}

function speciesName(species) {
  return species.faoCodeSnapshot
    ? `${species.nameSnapshot} (${species.faoCodeSnapshot})`
    : species.nameSnapshot
}

function formattedDate(value) {
  return value ? formatDate(value, 'd MMMM yyyy') : null
}

function tripSection(record) {
  const multipleGears = record.gears.length > 1
  return {
    heading: 'Trips details',
    rows: [
      row('Vessel', record.vessel.nameSnapshot),
      row('Departure date', formattedDate(record.trip.dateStarted)),
      row('Return date', formattedDate(record.trip.dateEnded)),
      row('Departure port', record.trip.departurePort?.nameSnapshot),
      row('Return port', record.trip.returnPort?.nameSnapshot),
      ...record.gears.map((entry) =>
        row(
          multipleGears
            ? `Statistical sub area (${entry.gear.nameSnapshot})`
            : 'Statistical sub area',
          entry.statisticalArea?.codeSnapshot
        )
      )
    ]
  }
}

function pairFishingSections(pairFishing) {
  if (!pairFishing.enabled) {
    return []
  }
  return [
    {
      heading: 'Pair fishing',
      rows: [
        row('Paired vessel', pairFishing.pairVessel),
        row('Paired skipper', pairFishing.pairSkipperName)
      ]
    }
  ]
}

function gearSections(gears) {
  return gears.map((entry, index) => ({
    heading: 'Gear used',
    gearId: entry.gear.id,
    kind: 'gear',
    gearName: entry.gear.nameSnapshot,
    startsGearSection: index === 0,
    rows: [
      row('Gear type', entry.gear.nameSnapshot),
      row('Area majority catch caught', entry.statisticalArea?.codeSnapshot),
      row(
        'Species caught',
        entry.speciesCaught.length
          ? entry.speciesCaught.map(speciesName).join(', ')
          : null
      ),
      ...entry.characteristics.map((item) => row(item.nameSnapshot, item.value))
    ]
  }))
}

function speciesCaughtSections(gears) {
  return gears
    .flatMap((entry) =>
      entry.speciesCaught.map((species) => ({
        heading: 'Species caught',
        gearId: entry.gear.id,
        kind: 'species',
        speciesName: speciesName(species),
        gearName: entry.gear.nameSnapshot,
        rows: [
          row(
            'Weight above minimum size retained (kg)',
            species.weightAboveMinimumKg
          ),
          row(
            'Weight below minimum size retained (kg)',
            species.weightBelowMinimumKg
          ),
          row('Weight legally discarded (kg)', species.weightLegallyDiscardedKg)
        ]
      }))
    )
    .map((section, index) => ({
      ...section,
      startsSpeciesSection: index === 0
    }))
}

function optionalRow(label, value) {
  return value == null ? [] : [row(label, value)]
}

function speciesNotLandedSection(speciesNotLanded) {
  return {
    heading: 'Species not landed',
    rows: [
      row('Not landed', speciesNotLanded.length ? 'Yes' : 'No'),
      ...speciesNotLanded.flatMap((species) => [
        row('Species', speciesName(species)),
        row(
          'Weight above minimum size kept onboard or in keep pots (kg)',
          species.weightAboveMinimumKg
        ),
        ...optionalRow(
          'Weight below minimum size kept onboard or in keep pots (kg)',
          species.weightBelowMinimumKg
        ),
        ...optionalRow(
          'Weight legally discarded (kg)',
          species.weightLegallyDiscardedKg
        )
      ])
    ]
  }
}

export function submittedSummary(record) {
  return [
    tripSection(record),
    ...pairFishingSections(record.pairFishing),
    ...gearSections(record.gears),
    ...speciesCaughtSections(record.gears),
    speciesNotLandedSection(record.speciesNotLanded)
  ]
}
