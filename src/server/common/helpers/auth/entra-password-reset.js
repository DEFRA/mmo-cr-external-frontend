import { isEntraMode, passwordResetBase } from './entra-config.js'
import { post, signInFailure } from './entra-client.js'

const PENDING_RESET_SESSION_KEY = 'entraPendingPasswordReset'
const CHALLENGE_TYPES = 'oob redirect'
const MAX_CODE_ATTEMPTS = 5
const RESET_MAX_AGE_MS = 10 * 60 * 1000
const MAX_POLLS = 10
const MAX_POLL_INTERVAL_MS = 2000
const MS_PER_SECOND = 1000

/** Outcomes the reset screens react to; every other failure is `unavailable`. */
export const passwordResetFailure = {
  invalidCode: 'invalid_code',
  tooManyCodeAttempts: 'too_many_code_attempts',
  expired: 'expired',
  passwordTooShort: 'password_too_short',
  passwordTooLong: 'password_too_long',
  passwordTooWeak: 'password_too_weak',
  passwordRecentlyUsed: 'password_recently_used',
  passwordBanned: 'password_banned',
  unavailable: 'unavailable'
}

const PASSWORD_SUBERRORS = new Map([
  ['password_too_short', passwordResetFailure.passwordTooShort],
  ['password_too_long', passwordResetFailure.passwordTooLong],
  ['password_too_weak', passwordResetFailure.passwordTooWeak],
  ['password_is_invalid', passwordResetFailure.passwordTooWeak],
  ['password_recently_used', passwordResetFailure.passwordRecentlyUsed],
  ['password_banned', passwordResetFailure.passwordBanned]
])

export class PasswordResetError extends Error {
  constructor(reason, cause) {
    super(`Password reset failed: ${reason}`)
    this.name = 'PasswordResetError'
    this.reason = reason
    this.errorCode = cause?.errorCode
    this.subError = cause?.subError
  }
}

function resetPost(path, fields) {
  return post(path, fields, {
    base: passwordResetBase(),
    stepPrefix: 'resetpassword:'
  })
}

function toResetError(error) {
  if (error instanceof PasswordResetError) {
    return error
  }
  if (error?.reason === signInFailure.invalidCode) {
    return new PasswordResetError(passwordResetFailure.invalidCode, error)
  }
  if (error?.reason === signInFailure.expired) {
    return new PasswordResetError(passwordResetFailure.expired, error)
  }
  const passwordReason = PASSWORD_SUBERRORS.get(error?.subError)
  return new PasswordResetError(
    passwordReason ?? passwordResetFailure.unavailable,
    error
  )
}

export function getPendingPasswordReset(request) {
  const pending = request.yar.get(PENDING_RESET_SESSION_KEY)
  if (!pending) {
    return null
  }
  if (Date.now() - pending.createdAt > RESET_MAX_AGE_MS) {
    discardPendingPasswordReset(request)
    return null
  }
  return pending
}

export function discardPendingPasswordReset(request) {
  request.yar.clear(PENDING_RESET_SESSION_KEY)
}

function requirePending(request) {
  const pending = getPendingPasswordReset(request)
  if (!pending) {
    throw new PasswordResetError(passwordResetFailure.expired)
  }
  return pending
}

function savePending(request, pending) {
  request.yar.set(PENDING_RESET_SESSION_KEY, pending)
  return pending
}

function storeChallenge(request, challenge, email) {
  return savePending(request, {
    email,
    continuationToken: challenge.continuation_token,
    codeLength: challenge.code_length ?? null,
    attempts: 0,
    verified: false,
    createdAt: Date.now()
  })
}

async function sendCode(continuationToken) {
  const challenge = await resetPost('challenge', {
    continuation_token: continuationToken,
    challenge_type: CHALLENGE_TYPES
  })
  if (challenge.challenge_type !== 'oob') {
    throw new PasswordResetError(passwordResetFailure.unavailable)
  }
  return challenge
}

/**
 * Starts a reset and emails a code. An unknown address is handled exactly like
 * a known one, so the journey never reveals which accounts exist.
 */
export async function startPasswordReset(request, email) {
  discardPendingPasswordReset(request)

  if (!isEntraMode()) {
    return storeChallenge(request, { continuation_token: 'mock' }, email)
  }

  try {
    const started = await resetPost('start', {
      username: email,
      challenge_type: CHALLENGE_TYPES
    })
    return storeChallenge(
      request,
      await sendCode(started.continuation_token),
      email
    )
  } catch (error) {
    if (error?.errorCode === 'user_not_found') {
      return storeChallenge(request, { continuation_token: null }, email)
    }
    throw toResetError(error)
  }
}

/** Emails a new code; the previous code stops working. */
export async function resendPasswordResetCode(request) {
  const pending = requirePending(request)
  if (!isEntraMode() || !pending.continuationToken || pending.verified) {
    return savePending(request, { ...pending, attempts: 0 })
  }

  try {
    const challenge = await sendCode(pending.continuationToken)
    return savePending(request, {
      ...pending,
      continuationToken: challenge.continuation_token,
      attempts: 0
    })
  } catch (error) {
    discardPendingPasswordReset(request)
    throw toResetError(error)
  }
}

function recordWrongCode(request, pending) {
  const attempts = pending.attempts + 1
  if (attempts >= MAX_CODE_ATTEMPTS) {
    discardPendingPasswordReset(request)
    throw new PasswordResetError(passwordResetFailure.tooManyCodeAttempts)
  }
  savePending(request, { ...pending, attempts })
  throw new PasswordResetError(passwordResetFailure.invalidCode)
}

/** Checks the emailed code; on success the user may choose a new password. */
export async function verifyPasswordResetCode(request, code) {
  const pending = requirePending(request)

  if (!isEntraMode()) {
    return savePending(request, { ...pending, verified: true })
  }
  // No Entra reset exists for an unknown address, so every code is wrong.
  if (!pending.continuationToken) {
    return recordWrongCode(request, pending)
  }

  try {
    const verified = await resetPost('continue', {
      continuation_token: pending.continuationToken,
      grant_type: 'oob',
      oob: code
    })
    return savePending(request, {
      ...pending,
      continuationToken: verified.continuation_token,
      verified: true
    })
  } catch (error) {
    const resetError = toResetError(error)
    if (resetError.reason === passwordResetFailure.invalidCode) {
      return recordWrongCode(request, pending)
    }
    discardPendingPasswordReset(request)
    throw resetError
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function pollUntilComplete(continuationToken, intervalMs, remaining) {
  if (remaining === 0) {
    throw new PasswordResetError(passwordResetFailure.unavailable)
  }

  const result = await resetPost('poll_completion', {
    continuation_token: continuationToken
  })
  if (result.status === 'succeeded') {
    return
  }
  if (result.status === 'failed') {
    throw new PasswordResetError(passwordResetFailure.unavailable)
  }

  await wait(intervalMs)
  await pollUntilComplete(
    result.continuation_token ?? continuationToken,
    intervalMs,
    remaining - 1
  )
}

/** Sets the new password and waits for Entra to confirm it has been changed. */
export async function setNewPassword(request, newPassword) {
  const pending = requirePending(request)
  if (!pending.verified) {
    throw new PasswordResetError(passwordResetFailure.expired)
  }

  if (!isEntraMode()) {
    discardPendingPasswordReset(request)
    return
  }

  try {
    const submitted = await resetPost('submit', {
      continuation_token: pending.continuationToken,
      new_password: newPassword
    })
    const intervalMs = Math.min(
      Number(submitted.poll_interval ?? 1) * MS_PER_SECOND,
      MAX_POLL_INTERVAL_MS
    )
    await pollUntilComplete(submitted.continuation_token, intervalMs, MAX_POLLS)
    discardPendingPasswordReset(request)
  } catch (error) {
    const resetError = toResetError(error)
    // A rejected password can be retried with the same continuation token.
    if (!PASSWORD_SUBERRORS.has(resetError.subError)) {
      discardPendingPasswordReset(request)
    }
    throw resetError
  }
}
