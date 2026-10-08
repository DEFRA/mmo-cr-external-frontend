describe('config environment defaults', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  test.each([
    ['production', true, false, 'ecs', true, null],
    [
      'development',
      false,
      false,
      'pino-pretty',
      false,
      'http://localhost:3002'
    ],
    ['test', false, true, 'pino-pretty', false, 'http://localhost:3002']
  ])(
    'Should apply %s environment defaults',
    async (
      environment,
      isProduction,
      isTest,
      logFormat,
      secureContext,
      referenceDataUrl
    ) => {
      vi.stubEnv('NODE_ENV', environment)
      vi.resetModules()

      const { config } = await import('./config.js')

      expect(config.get('isProduction')).toBe(isProduction)
      expect(config.get('isTest')).toBe(isTest)
      expect(config.get('isDevelopment')).toBe(environment === 'development')
      expect(config.get('log.format')).toBe(logFormat)
      expect(config.get('isSecureContextEnabled')).toBe(secureContext)
      expect(config.get('referenceData.serviceUrl')).toBe(referenceDataUrl)
      expect(config.get('log.redact')).toEqual(
        isProduction
          ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
          : []
      )
    }
  )
})
