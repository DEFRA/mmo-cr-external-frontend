// Walkthrough-only mock data — fictional, not persisted.
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
      { id: 'numberOfTrawlNets', label: 'Number of trawl nets' },
      { id: 'meshSize', label: 'Mesh size (mm)' }
    ]
  },
  {
    id: 'dredge',
    label: 'Dredge',
    hint: '2 dredges',
    requiresPotsDetails: false,
    displayOrder: 3,
    measurements: [
      { id: 'numberOfDredges', label: 'Number of dredges' },
      { id: 'numberOfTimesShot', label: 'Number of times shot' }
    ]
  },
  {
    id: 'handlines-pole-lines',
    label: 'Handlines and pole lines (hand operated)',
    hint: 'Hint text',
    requiresPotsDetails: false,
    displayOrder: 4,
    measurements: [{ id: 'rodsAndLines', label: 'Number of rods and lines' }]
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
    measurements: [
      { id: 'totalHauled', label: 'Total pots or traps hauled' },
      { id: 'totalInWater', label: 'Total pots or traps left in water' }
    ]
  },
  {
    id: 'seine-nets',
    label: 'Seine nets (not specified)',
    hint: '100mm mesh',
    requiresPotsDetails: false,
    displayOrder: 7,
    measurements: [{ id: 'meshSize', label: 'Mesh size (mm)' }]
  },
  {
    id: 'trammel-net',
    label: 'Trammel net',
    hint: '80mm mesh',
    requiresPotsDetails: false,
    displayOrder: 8
  },
  {
    id: 'traps',
    label: 'Traps',
    hint: null,
    requiresPotsDetails: false,
    displayOrder: 9,
    measurements: [
      { id: 'totalHauled', label: 'Total pots or traps hauled' },
      { id: 'totalInWater', label: 'Total pots or traps left in water' }
    ]
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
    label: 'Long line',
    hint: null,
    requiresPotsDetails: false,
    displayOrder: 11,
    measurements: [
      { id: 'totalHooksHauled', label: 'Total hooks hauled' },
      { id: 'totalHooksInWater', label: 'Total hooks left in water' }
    ]
  },
  {
    id: 'tangle-net',
    label: 'Tangle net',
    hint: '100mm mesh',
    requiresPotsDetails: false,
    displayOrder: 12
  }
]
