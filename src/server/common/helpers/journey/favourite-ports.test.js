import {
  addFavouritePortCode,
  getFavouritePortCodes
} from './favourite-ports.js'

function createFakeRequest(initialState) {
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

describe('#getFavouritePortCodes', () => {
  test('Should return an empty array when no favourite ports are stored', () => {
    const request = createFakeRequest(undefined)
    expect(getFavouritePortCodes(request)).toEqual([])
  })

  test('Should return the stored favourite port codes', () => {
    const request = createFakeRequest({ favouritePorts: ['GB000123'] })
    expect(getFavouritePortCodes(request)).toEqual(['GB000123'])
  })
})

describe('#addFavouritePortCode', () => {
  test('Should add a new code to an empty list', () => {
    const request = createFakeRequest(undefined)
    const result = addFavouritePortCode(request, 'GB000123')

    expect(result).toEqual(['GB000123'])
    expect(getFavouritePortCodes(request)).toEqual(['GB000123'])
  })

  test('Should append a new code to an existing list', () => {
    const request = createFakeRequest({ favouritePorts: ['GB000123'] })
    const result = addFavouritePortCode(request, 'GB000456')

    expect(result).toEqual(['GB000123', 'GB000456'])
  })

  test('Should return the existing list unchanged when the code is already present', () => {
    const request = createFakeRequest({ favouritePorts: ['GB000123'] })
    const result = addFavouritePortCode(request, 'GB000123')

    expect(result).toEqual(['GB000123'])
    expect(getFavouritePortCodes(request)).toEqual(['GB000123'])
  })
})
