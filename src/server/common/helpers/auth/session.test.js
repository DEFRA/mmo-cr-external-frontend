import { isSignedIn, signIn, signOut } from './session.js'

function fakeRequest(initialState) {
  let state = initialState
  let resetCalled = false

  return {
    yar: {
      id: 'fake-session-id',
      get: (key) => state?.[key],
      set: (key, value) => {
        state = { ...state, [key]: value }
      },
      reset: () => {
        resetCalled = true
        state = {}
      }
    },
    _wasReset: () => resetCalled
  }
}

describe('#isSignedIn', () => {
  test('Should return false when no session state is stored', () => {
    expect(isSignedIn(fakeRequest(undefined))).toBe(false)
  })

  test('Should return false when the signed-in flag is not set', () => {
    expect(isSignedIn(fakeRequest({ journey: {} }))).toBe(false)
  })

  test('Should return true when the signed-in flag is set', () => {
    expect(isSignedIn(fakeRequest({ signedIn: true }))).toBe(true)
  })

  test('Should return false when the session has no id (session never initialised, e.g. a 404 response)', () => {
    const request = { yar: { id: null, get: () => true } }

    expect(isSignedIn(request)).toBe(false)
  })

  test('Should return false when there is no yar decoration at all', () => {
    expect(isSignedIn({})).toBe(false)
  })
})

describe('#signIn', () => {
  test('Should set the signed-in flag', () => {
    const request = fakeRequest(undefined)

    signIn(request)

    expect(isSignedIn(request)).toBe(true)
  })
})

describe('#signOut', () => {
  test('Should reset the whole session', () => {
    const request = fakeRequest({
      signedIn: true,
      journey: { tripSameDate: true }
    })

    signOut(request)

    expect(request._wasReset()).toBe(true)
    expect(isSignedIn(request)).toBe(false)
  })
})
