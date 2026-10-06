// Walkthrough-only mock data — fictional, not persisted.
const meshSizeMeasurement = {
  id: 'meshSize',
  label: 'Mesh size (mm)',
  emptyMessage: 'Enter the mesh size, in millimetres',
  invalidMessage: 'Mesh size must be a whole number greater than 0'
}

const potsOrTrapsMeasurements = [
  {
    id: 'totalHauled',
    label: 'Total pots or traps hauled',
    emptyMessage: 'Enter the total number of pots or traps hauled',
    invalidMessage:
      'Total pots or traps hauled must be a whole number greater than 0'
  },
  {
    id: 'totalInWater',
    label: 'Total pots or traps left in water',
    emptyMessage: 'Enter the total number of pots or traps left in the water',
    invalidMessage:
      'Total pots or traps left in the water must be a whole number greater than 0'
  }
]

const gillnetMeasurements = [
  meshSizeMeasurement,
  {
    id: 'netLengthHauled',
    label: 'Total length of nets hauled during the trip (m)',
    emptyMessage:
      'Enter the total length of nets hauled during the trip, in metres'
  },
  {
    id: 'netLengthLeft',
    label: 'Total length of nets left in the water at the end of the trip (m)',
    emptyMessage:
      'Enter the total length of nets left in the water at the end of the trip, in metres'
  }
]

export const gearSelection = [
  {
    id: 'beam-trawl',
    label: 'Beam trawl',
    hint: null,
    requiresPotsDetails: false,
    displayOrder: 1
  },
  {
    id: 'bottom-otter-trawl',
    label: 'Bottom otter trawl',
    hint: '80mm mesh',
    requiresPotsDetails: false,
    displayOrder: 2,
    measurements: [
      {
        id: 'numberOfTrawlNets',
        label: 'Number of trawl nets',
        emptyMessage: 'Enter the number of trawl nets'
      },
      meshSizeMeasurement
    ]
  },
  {
    id: 'dredge',
    label: 'Dredge',
    hint: '2 dredges',
    requiresPotsDetails: false,
    displayOrder: 3,
    measurements: [
      {
        id: 'numberOfDredges',
        label: 'Number of dredges',
        emptyMessage: 'Enter the number of dredges',
        invalidMessage:
          'Number of dredges must be a whole number greater than 0'
      },
      {
        id: 'numberOfTimesShot',
        label: 'Number of times shot',
        emptyMessage:
          'Enter the number of times this gear was shot during the trip'
      }
    ]
  },
  {
    id: 'handlines-pole-lines',
    label: 'Handlines and pole lines (hand operated)',
    hint: 'Hint text',
    requiresPotsDetails: false,
    displayOrder: 4,
    measurements: [
      {
        id: 'rodsAndLines',
        label: 'Number of rods and lines',
        emptyMessage: 'Enter the number of rods and lines',
        invalidMessage:
          'Number of rods and lines must be a whole number greater than 0'
      }
    ]
  },
  {
    id: 'miscellaneous-gear-diving',
    label: 'Miscellaneous gear (diving)',
    hint: null,
    requiresPotsDetails: false,
    displayOrder: 5,
    measurements: []
  },
  {
    id: 'pots',
    label: 'Pots',
    hint: null,
    requiresPotsDetails: true,
    displayOrder: 6,
    measurements: potsOrTrapsMeasurements
  },
  {
    id: 'seine-nets',
    label: 'Seine nets (not specified)',
    hint: '100mm mesh',
    requiresPotsDetails: false,
    displayOrder: 7,
    measurements: [meshSizeMeasurement]
  },
  {
    id: 'trammel-net',
    label: 'Trammel net',
    hint: '80mm mesh',
    requiresPotsDetails: false,
    displayOrder: 8,
    measurements: gillnetMeasurements
  },
  {
    id: 'traps',
    label: 'Traps',
    hint: null,
    requiresPotsDetails: false,
    displayOrder: 9,
    measurements: potsOrTrapsMeasurements
  }
]

// The full searchable gear catalogue for Add gear (CRAR-158) — a superset of
// gearSelection, which remains the default favourites list for existing journeys.
export const gearCatalogue = [
  ...gearSelection,
  {
    id: 'set-net',
    label: 'Set net',
    hint: '90mm mesh',
    requiresPotsDetails: false,
    displayOrder: 10
  },
  {
    id: 'long-line',
    label: 'Drifting longlines',
    hint: null,
    requiresPotsDetails: false,
    displayOrder: 11,
    measurements: [
      {
        id: 'totalHooksHauled',
        label: 'Total hooks hauled',
        emptyMessage: 'Enter the total number of hooks hauled',
        invalidMessage:
          'Total hooks hauled must be a whole number greater than 0'
      },
      {
        id: 'totalHooksInWater',
        label: 'Total hooks left in water',
        emptyMessage: 'Enter the total number of hooks left in the water',
        invalidMessage:
          'Total hooks left in the water must be a whole number greater than 0'
      }
    ]
  },
  {
    id: 'tangle-net',
    label: 'Tangle net',
    hint: '100mm mesh',
    requiresPotsDetails: false,
    displayOrder: 12
  },
  {
    id: 'gillnets-trammel-nets',
    label: 'Nets (Gillnets and Trammels)',
    hint: null,
    requiresPotsDetails: false,
    displayOrder: 13,
    measurements: gillnetMeasurements
  }
]
