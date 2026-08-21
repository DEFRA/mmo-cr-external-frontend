// Walkthrough-only mock data — fictional, not persisted. No real passwords are stored.
export const account = {
  name: 'James Smith',
  email: 'john.smith@email.com',
  role: 'Vessel owner',
  passwordMasked: '**********',
  vesselsSkipperOf: 'N/A',
  addressLines: ['175 Roding Lane', 'Redbridge Lakes', 'Woodford', 'IG8 4ED'],
  contactNumber: '071234 56789',
  skippers: 'N/A',
  portsUsed: ['Hastings'],
  gearOnboard: [
    { label: 'Pots', hint: null },
    { label: 'Seine nets', hint: '100mm mesh' },
    { label: 'Beam trawl', hint: '10mm mesh' }
  ]
}
