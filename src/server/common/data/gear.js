// Walkthrough-only mock data — fictional, not persisted.
// `measurement` (FR3/CRAR-181) is the single mandatory whole-number figure captured
// when a gear type is added to favourites; null means no measurement is required.
export const gearSelection = [
  {
    id: 'beam-trawl',
    label: 'Beam trawl',
    hint: null,
    requiresPotsDetails: false,
    measurement: { id: 'numberOfTrawlNets', label: 'Number of trawl nets' },
    displayOrder: 1
  },
  {
    id: 'bottom-otter-trawl',
    label: 'Bottom otter trawl',
    hint: '80mm mesh',
    requiresPotsDetails: false,
    measurement: { id: 'meshSize', label: 'Mesh size (mm)' },
    displayOrder: 2
  },
  {
    id: 'dredge',
    label: 'Dredge',
    hint: '2 dredges',
    requiresPotsDetails: false,
    measurement: { id: 'numberOfDredges', label: 'Number of dredges' },
    displayOrder: 3
  },
  {
    id: 'handlines-pole-lines',
    label: 'Handlines and pole lines (hand operated)',
    hint: 'Hint text',
    requiresPotsDetails: false,
    measurement: { id: 'numberOfHooks', label: 'Number of hooks' },
    displayOrder: 4
  },
  {
    id: 'miscellaneous-gear-diving',
    label: 'Miscellaneous gear (diving)',
    hint: null,
    requiresPotsDetails: false,
    measurement: null,
    displayOrder: 5
  },
  {
    id: 'pots',
    label: 'Pots',
    hint: null,
    requiresPotsDetails: true,
    measurement: { id: 'numberOfPots', label: 'Number of pots' },
    displayOrder: 6
  },
  {
    id: 'seine-nets',
    label: 'Seine nets (not specified)',
    hint: '100mm mesh',
    requiresPotsDetails: false,
    measurement: { id: 'meshSize', label: 'Mesh size (mm)' },
    displayOrder: 7
  },
  {
    id: 'trammel-net',
    label: 'Trammel net',
    hint: '80mm mesh',
    requiresPotsDetails: false,
    measurement: { id: 'meshSize', label: 'Mesh size (mm)' },
    displayOrder: 8
  },
  {
    id: 'traps',
    label: 'Traps',
    hint: null,
    requiresPotsDetails: false,
    measurement: { id: 'numberOfTraps', label: 'Number of traps' },
    displayOrder: 9
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
    measurement: { id: 'meshSize', label: 'Mesh size (mm)' },
    displayOrder: 10
  },
  {
    id: 'long-line',
    label: 'Long line',
    hint: null,
    requiresPotsDetails: false,
    measurement: { id: 'numberOfHooks', label: 'Number of hooks' },
    displayOrder: 11
  },
  {
    id: 'tangle-net',
    label: 'Tangle net',
    hint: '100mm mesh',
    requiresPotsDetails: false,
    measurement: { id: 'totalNetLength', label: 'Total net length (m)' },
    displayOrder: 12
  }
]
