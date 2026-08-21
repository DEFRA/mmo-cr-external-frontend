import {
  getAmendmentState,
  setAmendmentState,
  clearAmendmentState
} from './amendment.js'

function fakeRequest(initialState) {
  let state = initialState
  return {
    yar: {
      get: () => state,
      set: (_key, value) => {
        state = value
      }
    }
  }
}

describe('#getAmendmentState', () => {
  test('Should return an empty object when no amendment state is stored', () => {
    const request = fakeRequest(undefined)
    expect(getAmendmentState(request)).toEqual({})
  })

  test('Should return the stored amendment state', () => {
    const request = fakeRequest({ recordId: 'unsent-1', reason: 'test' })
    expect(getAmendmentState(request)).toEqual({
      recordId: 'unsent-1',
      reason: 'test'
    })
  })
})

describe('#setAmendmentState', () => {
  test('Should merge a patch into any existing amendment state', () => {
    const request = fakeRequest({ recordId: 'unsent-1' })
    setAmendmentState(request, { reason: 'Corrected weight' })
    expect(getAmendmentState(request)).toEqual({
      recordId: 'unsent-1',
      reason: 'Corrected weight'
    })
  })
})

describe('#clearAmendmentState', () => {
  test('Should clear the stored amendment state', () => {
    const request = fakeRequest({ recordId: 'unsent-1', reason: 'test' })
    clearAmendmentState(request)
    expect(getAmendmentState(request)).toEqual({})
  })
})
