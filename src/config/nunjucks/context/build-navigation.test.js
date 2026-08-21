import { buildNavigation } from './build-navigation.js'

function fakeRequest({ signedIn, path } = {}) {
  return {
    path,
    yar: { id: 'fake-session-id', get: () => signedIn }
  }
}

describe('#buildNavigation', () => {
  test('Should return no navigation items when signed out', () => {
    expect(buildNavigation(fakeRequest({ signedIn: false }))).toEqual([])
  })

  test('Should return no navigation items when there is no request', () => {
    expect(buildNavigation(undefined)).toEqual([])
  })

  test('Should return Home, Your account and a Sign out form when signed in', () => {
    const navigation = buildNavigation(
      fakeRequest({ signedIn: true, path: '/records' })
    )

    expect(navigation[0]).toEqual({ text: 'Home', href: '/records' })
    expect(navigation[1]).toEqual({
      text: 'Your account',
      href: '/account',
      current: false
    })
    expect(navigation[2].html).toContain('method="post"')
    expect(navigation[2].html).toContain('action="/sign-out"')
    expect(navigation[2].html).toContain('Sign out')
  })

  test('Should mark Your account as current on the Account page', () => {
    const navigation = buildNavigation(
      fakeRequest({ signedIn: true, path: '/account' })
    )

    expect(navigation.find((item) => item.text === 'Your account')).toEqual({
      text: 'Your account',
      href: '/account',
      current: true
    })
  })
})
