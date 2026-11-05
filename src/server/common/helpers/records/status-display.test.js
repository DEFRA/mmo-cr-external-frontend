import { getStatusDisplay, getRecordDisplayStatus } from './status-display.js'

describe('Frontend lifecycle display', () => {
  test.each([
    ['DRAFT', 'Amended', 1, 'Draft'],
    ['DRAFT', 'Amended', 3, 'Draft'],
    ['SUBMITTED', 'Submitted', 1, 'Submitted'],
    ['SUBMITTED', 'Submitted', 2, 'Amended'],
    ['SUBMITTED', 'Submitted', 3, 'Amended'],
    ['SUBMITTED', 'Late', 2, 'Late'],
    ['COMPLETE', 'Complete', 2, 'Complete']
  ])(
    'Should display %s/%s with %i submissions as %s',
    (status, displayStatus, numberOfSubmissions, expected) => {
      expect(
        getRecordDisplayStatus({ status, displayStatus, numberOfSubmissions })
      ).toBe(expected)
    }
  )
})

describe('#getStatusDisplay', () => {
  test('Should show a green Submitted tag', () => {
    expect(getStatusDisplay('submitted')).toEqual({
      text: 'Submitted',
      tagClasses: 'govuk-tag--green'
    })
  })

  test('Should show a blue Amended tag', () => {
    expect(getStatusDisplay('amended')).toEqual({
      text: 'Amended',
      tagClasses: 'govuk-tag--blue'
    })
  })

  test('Should show a yellow Unsent tag', () => {
    expect(getStatusDisplay('unsent')).toEqual({
      text: 'Unsent',
      tagClasses: 'govuk-tag--yellow'
    })
  })

  test('Should show a yellow Draft tag', () => {
    expect(getStatusDisplay('draft')).toEqual({
      text: 'Draft',
      tagClasses: 'govuk-tag--yellow'
    })
  })

  test('Should show a pink Late tag', () => {
    expect(getStatusDisplay('late')).toEqual({
      text: 'Late',
      tagClasses: 'govuk-tag--pink'
    })
  })

  test('Should fall back to a safe grey Unknown tag for an unrecognised status', () => {
    expect(getStatusDisplay('some-future-status')).toEqual({
      text: 'Unknown',
      tagClasses: 'govuk-tag--grey'
    })
  })
})
