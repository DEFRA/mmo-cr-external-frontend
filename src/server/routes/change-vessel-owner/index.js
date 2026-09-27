const viewContext = () => ({
  pageTitle: 'Change in vessel ownership',
  heading: 'Change in vessel ownership',
  backLink: { href: '/account', text: 'Back' }
})

export const changeVesselOwnerController = {
  handler: (_request, h) => h.view('change-vessel-owner/index', viewContext())
}
