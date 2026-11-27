import { vi } from 'vitest'

const mockReadFileSync = vi.fn()
const mockLoggerError = vi.fn()

vi.mock('node:fs', async () => {
  const nodeFs = await import('node:fs')

  return {
    ...nodeFs,
    readFileSync: (file, ...args) =>
      String(file).endsWith('manifest.json')
        ? mockReadFileSync()
        : nodeFs.readFileSync(file, ...args)
  }
})
vi.mock('../../../server/common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ error: (...args) => mockLoggerError(...args) })
}))
vi.mock(import('#/config/config.js'), async (importOriginal) => {
  const originalModule = await importOriginal()
  return {
    config: {
      get(key) {
        if (key === 'isProduction') return true
        return originalModule.config.get(key)
      }
    }
  }
})

describe('context and cache', () => {
  beforeEach(() => {
    mockReadFileSync.mockReset()
    mockLoggerError.mockReset()
    vi.resetModules()
  })

  describe('#context', () => {
    const mockRequest = { path: '/', yar: { get: () => false } }

    describe('When Vite manifest file read succeeds', () => {
      let contextImport
      let contextResult

      beforeAll(async () => {
        contextImport = await import('./context.js')
      })

      beforeEach(() => {
        // Return JSON string
        mockReadFileSync.mockReturnValue(`{
        "application.js": "javascripts/application.js",
        "stylesheets/application.scss": "stylesheets/application.css"
      }`)

        contextResult = contextImport.context(mockRequest)
      })

      test('Should provide expected context', () => {
        expect(contextResult).toEqual({
          assetPath: '/public/assets',
          getAssetPath: expect.any(Function),
          navigation: [],
          serviceName: 'Record your catch',
          serviceUrl: '/',
          feedbackUrl: '#',
          lang: 'en',
          htmlLang: 'en',
          languageToggle: {
            current: 'en',
            other: 'cy',
            href: '/?lang=cy'
          }
        })
      })

      test('Should preserve gear and review context in the language link', () => {
        const result = contextImport.context({
          ...mockRequest,
          path: '/species-selection',
          query: { gearId: 'gear-2', return: '/check-answers', lang: 'en' }
        })
        const url = new URL(result.languageToggle.href, 'http://localhost')
        expect(url.searchParams.get('gearId')).toBe('gear-2')
        expect(url.searchParams.get('return')).toBe('/check-answers')
        expect(url.searchParams.get('lang')).toBe('cy')
      })

      test('Should preserve port journey step params in the language link', () => {
        const result = contextImport.context({
          ...mockRequest,
          path: '/add-port',
          query: { for: 'departure', entry: '1' }
        })
        expect(result.languageToggle.href).toBe(
          '/add-port?for=departure&entry=1&lang=cy'
        )
      })

      test('Should offer English when the request is in Welsh', () => {
        const result = contextImport.context({
          ...mockRequest,
          app: { lang: 'cy' }
        })

        expect(result.htmlLang).toBe('cy')
        expect(result.serviceName).toBe('Cofnodi eich dalfa')
        expect(result.languageToggle).toEqual({
          current: 'cy',
          other: 'en',
          href: '/?lang=en'
        })
      })

      describe('With valid asset path', () => {
        test('Should provide expected asset path', () => {
          expect(contextResult.getAssetPath('application.js')).toBe(
            '/public/application.js'
          )
        })
      })

      describe('With invalid asset path', () => {
        test('Should provide expected asset', () => {
          expect(contextResult.getAssetPath('an-image.png')).toBe(
            '/public/an-image.png'
          )
        })
      })
    })

    describe('When Vite manifest file read fails', () => {
      let contextImport

      beforeAll(async () => {
        contextImport = await import('./context.js')
      })

      beforeEach(() => {
        mockReadFileSync.mockReturnValue(new Error('File not found'))

        contextImport.context(mockRequest)
      })

      test('Should log that the Vite Manifest file is not available', () => {
        expect(mockLoggerError).toHaveBeenCalledWith(
          'Vite manifest.json not found'
        )
      })
    })
  })

  describe('#context cache', () => {
    const mockRequest = { path: '/', yar: { get: () => false } }
    let contextResult

    describe('Vite manifest file cache', () => {
      let contextImport

      beforeAll(async () => {
        contextImport = await import('./context.js')
      })

      beforeEach(() => {
        // Return JSON string
        mockReadFileSync.mockReturnValue(`{
        "application.js": "javascripts/application.js",
        "stylesheets/application.scss": "stylesheets/application.css"
      }`)

        contextResult = contextImport.context(mockRequest)
      })

      test('Should read file', () => {
        expect(mockReadFileSync).toHaveBeenCalled()
      })

      test('Should use cache', () => {
        expect(mockReadFileSync).not.toHaveBeenCalled()
      })

      test('Should provide expected context', () => {
        expect(contextResult).toEqual({
          assetPath: '/public/assets',
          getAssetPath: expect.any(Function),
          navigation: [],
          serviceName: 'Record your catch',
          serviceUrl: '/',
          feedbackUrl: '#',
          lang: 'en',
          htmlLang: 'en',
          languageToggle: {
            current: 'en',
            other: 'cy',
            href: '/?lang=cy'
          }
        })
      })
    })
  })
})
