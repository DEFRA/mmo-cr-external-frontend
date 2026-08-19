import { backForSpeciesSelection } from '#/server/common/helpers/journey/navigation.js'
import { getData } from '#/server/common/data/get-data.js'

export const speciesSelectionController = {
  handler(request, h) {
    return h.view('species-selection/index', {
      pageTitle: 'Species selection',
      heading: 'Species selection',
      backLink: {
        href: backForSpeciesSelection(request),
        text: 'Back'
      },
      speciesOptions: getData('speciesSelection')
    })
  }
}

export const speciesSelectionSubmitController = {
  handler(_request, h) {
    return h.redirect('/species-weight').code(303)
  }
}
