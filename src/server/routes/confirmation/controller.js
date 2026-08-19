import { getData } from '#/server/common/data/get-data.js'

export const confirmationController = {
  handler(_request, h) {
    const { reference } = getData('confirmation')

    return h.view('confirmation/index', {
      pageTitle: 'Catch record submitted',
      heading: 'Catch record submitted',
      reference
    })
  }
}
