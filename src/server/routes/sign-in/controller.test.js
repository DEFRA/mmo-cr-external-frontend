import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'

describe('#signInController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should provide expected response', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/sign-in'
    })

    expect(result).toEqual(expect.stringContaining('Sign in |'))
    expect(statusCode).toBe(statusCodes.ok)
  })

  test('Should link the unsupported actions to the Empty Page with a return path', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/sign-in'
    })
    const $ = load(result)

    expect($('a[href="/not-implemented?return=/sign-in"]')).toHaveLength(2)
  })

  describe('Sign in form', () => {
    let $

    beforeAll(async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/sign-in'
      })
      $ = load(result)
    })

    test('Should render the expected heading', () => {
      expect($('[data-testid="app-heading-title"]').text().trim()).toBe(
        'Sign in'
      )
    })

    test('Should render an email input with the expected attributes and label', () => {
      const $email = $('input#email')

      expect($email.attr('type')).toBe('email')
      expect($email.attr('name')).toBe('email')
      expect($email.attr('autocomplete')).toBe('username')
      expect($email.attr('value')).toBeUndefined()
      expect($('label[for="email"]').text().trim()).toBe('Email address')
    })

    test('Should render a password input with the expected attributes and label', () => {
      const $password = $('input#password')

      expect($password.attr('type')).toBe('password')
      expect($password.attr('name')).toBe('password')
      expect($password.attr('autocomplete')).toBe('current-password')
      expect($password.attr('value')).toBeUndefined()
      expect($('label[for="password"]').text().trim()).toBe('Password')
    })

    test('Should render a Sign in submit button', () => {
      expect($('form button, form input[type="submit"]').text().trim()).toBe(
        'Sign in'
      )
    })

    test('Should render the "Having trouble signing in?" heading', () => {
      expect(
        $('h2').filter(
          (_i, el) => $(el).text().trim() === 'Having trouble signing in?'
        )
      ).toHaveLength(1)
    })
  })
})

describe('#signInSubmitController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should redirect to the records list', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/sign-in'
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/records')
  })

  test('Should redirect to the records list without echoing submitted credentials', async () => {
    const { statusCode, headers, result } = await server.inject({
      method: 'POST',
      url: '/sign-in',
      payload: {
        email: 'test@example.com',
        password: 'not-a-real-secret'
      }
    })

    expect(statusCode).toBe(303)
    expect(headers.location).toBe('/records')
    expect(headers.location).not.toContain('test@example.com')
    expect(headers.location).not.toContain('not-a-real-secret')
    expect(result ?? '').not.toContain('test@example.com')
    expect(result ?? '').not.toContain('not-a-real-secret')
  })
})
