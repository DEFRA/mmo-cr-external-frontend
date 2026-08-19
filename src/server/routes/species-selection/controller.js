import { backForSpeciesSelection } from '#/server/common/helpers/journey/navigation.js'

export const speciesSelectionController = {
  handler(request, h) {
    return h.view('species-selection/index', {
      pageTitle: 'Species selection',
      heading: 'Species selection',
      backLink: {
        href: backForSpeciesSelection(request),
        text: 'Back'
      }
    })
  }
}

export const speciesSelectionSubmitController = {
  handler(_request, h) {
    return h.redirect('/species-weight').code(303)
  }
}
