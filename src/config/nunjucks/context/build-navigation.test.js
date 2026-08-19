import { buildNavigation } from './build-navigation.js'

describe('#buildNavigation', () => {
  test('Should provide expected placeholder navigation details', () => {
    expect(buildNavigation()).toEqual([
      {
        text: 'Home',
        href: '#'
      },
      {
        text: 'Your account',
        href: '#'
      },
      {
        text: 'Sign out',
        href: '#'
      }
    ])
  })
})
