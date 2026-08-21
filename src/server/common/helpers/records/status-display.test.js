import { getStatusDisplay } from './status-display.js'

describe('#getStatusDisplay', () => {
  test('Should show a green Submitted tag', () => {
    expect(getStatusDisplay('submitted')).toEqual({
      text: 'Submitted',
      tagClasses: 'govuk-tag--green'
    })
  })

  test('Should show a default (blue) Amended tag', () => {
    expect(getStatusDisplay('amended')).toEqual({
      text: 'Amended',
      tagClasses: ''
    })
  })

  test('Should show a yellow Unsent tag', () => {
    expect(getStatusDisplay('unsent')).toEqual({
      text: 'Unsent',
      tagClasses: 'govuk-tag--yellow'
    })
  })

  test('Should show a red Late tag', () => {
    expect(getStatusDisplay('late')).toEqual({
      text: 'Late',
      tagClasses: 'govuk-tag--red'
    })
  })

  test('Should fall back to a safe grey Unknown tag for an unrecognised status', () => {
    expect(getStatusDisplay('some-future-status')).toEqual({
      text: 'Unknown',
      tagClasses: 'govuk-tag--grey'
    })
  })
})
