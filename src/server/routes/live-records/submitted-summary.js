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

export function submittedSummary(record) {
  const multipleGears = record.gears.length > 1
  const sections = [
    {
      heading: 'Trips details',
      rows: [
        row('Vessel', record.vessel.nameSnapshot),
        row(
          'Departure date',
          record.trip.dateStarted
            ? formatDate(record.trip.dateStarted, 'd MMMM yyyy')
            : null
        ),
        row(
          'Return date',
          record.trip.dateEnded
            ? formatDate(record.trip.dateEnded, 'd MMMM yyyy')
            : null
        ),
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
  ]
  if (record.pairFishing.enabled) {
    sections.push({
      heading: 'Pair fishing',
      rows: [
        row('Paired vessel', record.pairFishing.pairVessel),
        row('Paired skipper', record.pairFishing.pairSkipperName)
      ]
    })
  }
  for (const [index, entry] of record.gears.entries()) {
    sections.push({
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
        ...entry.characteristics.map((item) =>
          row(item.nameSnapshot, item.value)
        )
      ]
    })
  }
  let startsSpeciesSection = true
  for (const entry of record.gears) {
    for (const species of entry.speciesCaught) {
      sections.push({
        heading: 'Species caught',
        gearId: entry.gear.id,
        kind: 'species',
        speciesName: speciesName(species),
        gearName: entry.gear.nameSnapshot,
        startsSpeciesSection,
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
      })
      startsSpeciesSection = false
    }
  }
  sections.push({
    heading: 'Species not landed',
    rows: [
      row('Not landed', record.speciesNotLanded.length ? 'Yes' : 'No'),
      ...record.speciesNotLanded.flatMap((species) => [
        row('Species', speciesName(species)),
        row(
          'Weight above minimum size kept onboard or in keep pots (kg)',
          species.weightAboveMinimumKg
        ),
        ...(species.weightBelowMinimumKg != null
          ? [
              row(
                'Weight below minimum size kept onboard or in keep pots (kg)',
                species.weightBelowMinimumKg
              )
            ]
          : []),
        ...(species.weightLegallyDiscardedKg != null
          ? [
              row(
                'Weight legally discarded (kg)',
                species.weightLegallyDiscardedKg
              )
            ]
          : [])
      ])
    ]
  })
  return sections
}
