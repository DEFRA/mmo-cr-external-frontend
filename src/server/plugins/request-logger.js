import hapiPino from 'hapi-pino'

import { loggerOptions } from './logger-options.js'

// The Entra callback URL carries a one-time authorization code; never log it.
const pathToIgnore = (_, request) =>
  request.path.startsWith('/public') ||
  request.path === '/health' ||
  request.path === '/favicon.ico' ||
  request.path === '/auth/callback'

const requestLogger = {
  plugin: hapiPino,
  options: {
    ignoreFunc: pathToIgnore,
    ...loggerOptions
  }
}

export { requestLogger }
