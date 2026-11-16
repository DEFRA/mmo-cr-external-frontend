import { config } from '#/config/config.js'
import { assertAuthenticationConfiguration } from './entra.js'

describe('#assertAuthenticationConfiguration', () => {
  let originalAuthentication
  let originalEnvironment

  beforeEach(() => {
    originalAuthentication = config.get('authentication')
    originalEnvironment = config.get('catchRecording.environment')
  })

  afterEach(() => {
    config.set('authentication', originalAuthentication)
    config.set('catchRecording.environment', originalEnvironment)
  })

  function useEntra(overrides = {}) {
    config.set('authentication', {
      mode: 'entra',
      entra: {
        tenantSubdomain: 'external-tenant',
        clientId: '00000000-0000-4000-8000-000000000001',
        ...overrides
      }
    })
  }

  test.each(['local', 'dev', 'test'])(
    'Should allow mock authentication in the %s environment',
    (environment) => {
      config.set('catchRecording.environment', environment)

      expect(() => assertAuthenticationConfiguration()).not.toThrow()
    }
  )

  test.each(['prod', 'perf-test', 'ext-test'])(
    'Should refuse mock authentication in the %s environment',
    (environment) => {
      config.set('catchRecording.environment', environment)

      expect(() => assertAuthenticationConfiguration()).toThrow(
        'Mock authentication is not permitted'
      )
    }
  )

  test('Should accept a tenant subdomain and client ID, with no client secret', () => {
    useEntra()

    expect(() => assertAuthenticationConfiguration()).not.toThrow()
  })

  test('Should name every missing Entra setting', () => {
    useEntra({ tenantSubdomain: null, clientId: null })

    expect(() => assertAuthenticationConfiguration()).toThrow(
      'ENTRA_TENANT_SUBDOMAIN, ENTRA_CLIENT_ID'
    )
  })

  test('Should reject a client ID that is not a GUID', () => {
    useEntra({ clientId: 'not-a-guid' })

    expect(() => assertAuthenticationConfiguration()).toThrow(
      'ENTRA_CLIENT_ID must be a GUID'
    )
  })

  test.each(['evil.example/', 'tenant.ciamlogin.com', '-tenant'])(
    'Should reject the unsafe tenant subdomain %s',
    (tenantSubdomain) => {
      useEntra({ tenantSubdomain })

      expect(() => assertAuthenticationConfiguration()).toThrow(
        'ENTRA_TENANT_SUBDOMAIN is invalid'
      )
    }
  )
})
