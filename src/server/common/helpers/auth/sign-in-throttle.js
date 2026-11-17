import { createHash } from 'node:crypto'

import { config } from '#/config/config.js'

const MAX_FAILED_ATTEMPTS = 10
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000

function keyFor(email) {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

/**
 * Limits failed sign-in attempts per email address across all server instances.
 * Keyed by a hash, so email addresses are never stored in the cache.
 */
export const signInThrottle = {
  plugin: {
    name: 'sign-in-throttle',
    register(server) {
      server.app.signInAttempts = server.cache({
        cache: config.get('session.cache.name'),
        segment: 'sign-in-attempts',
        expiresIn: LOCKOUT_WINDOW_MS
      })
    }
  }
}

export async function isSignInLocked(request, email) {
  const failures = await request.server.app.signInAttempts.get(keyFor(email))
  return (failures ?? 0) >= MAX_FAILED_ATTEMPTS
}

export async function recordFailedSignIn(request, email) {
  const cache = request.server.app.signInAttempts
  const key = keyFor(email)
  await cache.set(key, ((await cache.get(key)) ?? 0) + 1)
}

export async function clearFailedSignIns(request, email) {
  await request.server.app.signInAttempts.drop(keyFor(email))
}
