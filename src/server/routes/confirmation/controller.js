import { getData } from '#/server/common/data/get-data.js'

const pageTitle = 'Your catch record has been submitted'

export const confirmationController = {
  handler(_request, h) {
    const { reference } = getData('confirmation')

    return h.view('confirmation/index', {
      pageTitle,
      heading: pageTitle,
      backLink: {
        href: '/records',
        text: 'Back'
      },
      reference
    })
  }
}
