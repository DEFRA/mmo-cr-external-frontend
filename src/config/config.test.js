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
      expect(config.get('catchRecording.serviceUrl')).toBeNull()
      expect(config.get('catchRecording.token')).toBeNull()
      expect(config.get('catchRecording.timeoutMs')).toBe(5000)
      expect(config.get('catchRecording.completionEnabled')).toBe(false)
      expect(config.get('catchRecording.environment')).toBe('local')
      expect(config.get('log.redact')).toEqual(
        isProduction
          ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
          : []
      )
    }
  )

  test('Should load Catch Recording settings from the environment', async () => {
    vi.stubEnv(
      'CATCH_RECORDING_SERVICE_URL',
      'https://service.test/catch-recording-service'
    )
    vi.stubEnv('CATCH_RECORDING_SERVICE_TOKEN', 'test-token')
    vi.stubEnv('CATCH_RECORDING_SERVICE_TIMEOUT_MS', '8000')
    vi.stubEnv('CATCH_RECORDING_COMPLETION_ENABLED', 'true')
    vi.stubEnv('ENVIRONMENT', 'dev')
    const { config } = await import('./config.js')
    expect(config.get('catchRecording')).toEqual({
      completionEnabled: true,
      enabled: false,
      serviceUrl: 'https://service.test/catch-recording-service',
      token: 'test-token',
      timeoutMs: 8000,
      environment: 'dev'
    })
  })
})
