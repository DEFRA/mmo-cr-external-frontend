// Walkthrough-only mock data — fictional, not persisted.
// Row order and display values match design/screens/DashboardJamesSmith.png.
export const allRecords = [
  {
    recordId: 'submitted-1',
    status: 'submitted',
    tripEndDate: '2026-07-22',
    vesselName: 'OLGA',
    createdBy: 'J.Smith'
  },
  {
    recordId: 'amended-1',
    status: 'amended',
    tripEndDate: '2026-07-15',
    vesselName: 'OLGA',
    createdBy: 'J.Smith'
  },
  {
    recordId: 'unsent-1',
    status: 'unsent',
    tripEndDate: '2026-07-10',
    vesselName: 'OLGA',
    createdBy: 'A.Jones'
  },
  {
    recordId: 'late-1',
    status: 'late',
    tripEndDate: '2026-07-15',
    vesselName: 'ACHILLES',
    createdBy: 'A.Jones',
    details: {
      reference: 'CC-2026-123456',
      vesselName: 'ACHILLES',
      vesselRegistration: 'FIN-126-U',
      departureDate: '2026-06-15',
      returnDate: '2026-06-17',
      submittedDate: '2026-06-17',
      submittedTime: '01:35',
      submittedBy: 'John Smith',
      departurePort: 'Hastings',
      returnPort: 'Hastings',
      statisticalSubArea: '38E84',
      gear: 'Bottom otter trawls (TBB)',
      potsHauled: 2,
      potsInWater: 0,
      species: 'Atlantic cod',
      weightAboveMinimumRetained: 250,
      weightBelowMinimumRetained: 10,
      weightLegallyDiscarded: 5,
      weightUnit: 'kg',
      catchNotLanded: true,
      notLandedSpecies: 'Atlantic salmon',
      notLandedWeightAboveMinimumKept: 50
    }
  }
]
