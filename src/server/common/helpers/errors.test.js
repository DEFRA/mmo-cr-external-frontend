import { vi } from 'vitest'
import Boom from '@hapi/boom'
import pino from 'pino'
import { ecsFormat } from '@elastic/ecs-pino-format'
import { config } from '#/config/config.js'

import { catchAll } from './errors.js'
import { createServer } from '../../server.js'
import { statusCodes } from '../constants/status-codes.js'

describe('#errors', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should provide expected Not Found page', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/non-existent-path'
    })

    expect(result).toEqual(
      expect.stringContaining('Page not found | Record your catch')
    )
    expect(statusCode).toBe(statusCodes.notFound)
  })
})

describe('#catchAll', () => {
  const mockErrorLogger = vi.fn()
  const mockWarnLogger = vi.fn()
  let originalEnvironment

  beforeEach(() => {
    originalEnvironment = config.get('catchRecording.environment')
    config.set('catchRecording.environment', 'prod')
  })

  afterEach(() => {
    config.set('catchRecording.environment', originalEnvironment)
  })

  const mockStack = 'Mock error stack'
  const errorPage = 'error/index'
  const mockRequest = (statusCode) => ({
    method: 'get',
    path: '/records',
    response: {
      isBoom: true,
      stack: mockStack,
      output: {
        statusCode
      }
    },
    logger: { error: mockErrorLogger, warn: mockWarnLogger }
  })
  const mockToolkitView = vi.fn()
  const mockToolkitCode = vi.fn()
  const mockToolkit = {
    view: mockToolkitView.mockReturnThis(),
    code: mockToolkitCode.mockReturnThis()
  }

  test.each([
    ['prod', 500, 'error'],
    ['dev', 403, 'warn'],
    ['test', 403, 'warn']
  ])(
    'Should serialize the %s %s stack into ECS at %s level',
    (environment, statusCode, level) => {
      config.set('catchRecording.environment', environment)
      const write = vi.fn()
      const request = {
        ...mockRequest(statusCode),
        response: Boom.boomify(new Error('Records failed'), { statusCode }),
        logger: pino(ecsFormat(), { write })
      }

      catchAll(request, mockToolkit)

      expect(write).toHaveBeenCalledTimes(1)
      expect(JSON.parse(write.mock.calls[0][0])).toMatchObject({
        'log.level': level,
        message: 'Request failed',
        method: 'get',
        path: '/records',
        statusCode,
        error: {
          type: 'Error',
          message: 'Records failed',
          stack_trace: request.response.stack
        }
      })
    }
  )

  test.each(['dev', 'test'])(
    'Should warn for client failures in %s without changing the response',
    (environment) => {
      config.set('catchRecording.environment', environment)
      const request = mockRequest(statusCodes.forbidden)

      catchAll(request, mockToolkit)

      expect(mockWarnLogger).toHaveBeenCalledExactlyOnceWith(
        {
          err: request.response,
          method: 'get',
          path: '/records',
          statusCode: statusCodes.forbidden
        },
        'Request failed'
      )
      expect(mockErrorLogger).not.toHaveBeenCalled()
      expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.forbidden)
    }
  )

  test.each(['local', 'prod', 'production', 'perf-test'])(
    'Should not add client-error warnings in %s',
    (environment) => {
      config.set('catchRecording.environment', environment)

      catchAll(mockRequest(statusCodes.forbidden), mockToolkit)

      expect(mockWarnLogger).not.toHaveBeenCalled()
      expect(mockErrorLogger).not.toHaveBeenCalled()
    }
  )

  test.each([400, 401, 404, 418, 499])(
    'Should warn for client status %s in dev',
    (statusCode) => {
      config.set('catchRecording.environment', 'dev')

      catchAll(mockRequest(statusCode), mockToolkit)

      expect(mockWarnLogger).toHaveBeenCalledOnce()
      expect(mockErrorLogger).not.toHaveBeenCalled()
    }
  )

  test('Should provide expected "Not Found" page', () => {
    catchAll(mockRequest(statusCodes.notFound), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalled()
    expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Page not found',
      heading: statusCodes.notFound,
      message: 'Page not found'
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.notFound)
  })

  test('Should provide expected "Forbidden" page', () => {
    catchAll(mockRequest(statusCodes.forbidden), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalled()
    expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Forbidden',
      heading: statusCodes.forbidden,
      message: 'Forbidden'
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.forbidden)
  })

  test('Should provide expected "Unauthorized" page', () => {
    catchAll(mockRequest(statusCodes.unauthorized), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalled()
    expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Unauthorized',
      heading: statusCodes.unauthorized,
      message: 'Unauthorized'
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.unauthorized)
  })

  test('Should provide expected "Bad Request" page', () => {
    catchAll(mockRequest(statusCodes.badRequest), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalled()
    expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Bad Request',
      heading: statusCodes.badRequest,
      message: 'Bad Request'
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.badRequest)
  })

  test('Should provide expected default page', () => {
    catchAll(mockRequest(statusCodes.imATeapot), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalled()
    expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Something went wrong',
      heading: statusCodes.imATeapot,
      message: 'Something went wrong'
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.imATeapot)
  })

  test.each([
    statusCodes.internalServerError,
    502,
    statusCodes.serviceUnavailable
  ])(
    'Should render the error page and log a structured stack for %s',
    (statusCode) => {
      const request = mockRequest(statusCode)
      catchAll(request, mockToolkit)

      expect(mockErrorLogger).toHaveBeenCalledExactlyOnceWith(
        {
          err: request.response,
          method: 'get',
          path: '/records',
          statusCode
        },
        'Request failed'
      )
      expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
        pageTitle: 'Something went wrong',
        heading: statusCode,
        message: 'Something went wrong'
      })
      expect(mockToolkitCode).toHaveBeenCalledWith(statusCode)
    }
  )
})
