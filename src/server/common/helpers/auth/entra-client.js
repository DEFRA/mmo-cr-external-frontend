import { createLogger } from '#/server/common/helpers/logging/logger.js'
import { authorityBase, entraSettings } from './entra-config.js'

export const entraLogger = createLogger().child({ component: 'entra-auth' })

const REQUEST_TIMEOUT_MS = 10000
const MAX_LOGGED_DESCRIPTION_LENGTH = 300
const BROWSER_REQUIRED_SUBERRORS = new Set([
  'mfa_required',
  'registration_required'
])

/** Outcomes the sign-in screens react to; every other failure is `unavailable`. */
export const signInFailure = {
  invalidCredentials: 'invalid_credentials',
  invalidCode: 'invalid_code',
  tooManyCodeAttempts: 'too_many_code_attempts',
  expired: 'expired',
  browserRequired: 'browser_required',
  unsupported: 'unsupported',
  cancelled: 'cancelled',
  unavailable: 'unavailable'
}

export class EntraSignInError extends Error {
  constructor(reason, detail) {
    super(`Entra sign-in failed: ${reason}`)
    this.name = 'EntraSignInError'
    this.reason = reason
    this.errorCode = detail?.error
    this.subError = detail?.suberror
  }
}

// Logs only metadata Entra returns for diagnosis; request bodies, tokens and codes are never logged.
function logEntraResponse(step, response, body, durationMs) {
  const entra = {
    step,
    status: response.status,
    durationMs,
    challengeType: body?.challenge_type,
    redirectReason: body?.redirect_reason,
    codeLength: body?.code_length,
    hasContinuationToken: Boolean(body?.continuation_token),
    hasIdToken: Boolean(body?.id_token),
    hasAccessToken: Boolean(body?.access_token),
    hasRefreshToken: Boolean(body?.refresh_token),
    error: body?.error,
    subError: body?.suberror,
    errorCodes: body?.error_codes,
    errorDescription: body?.error_description?.slice(
      0,
      MAX_LOGGED_DESCRIPTION_LENGTH
    ),
    traceId: body?.trace_id,
    correlationId: body?.correlation_id,
    contentType: body ? undefined : response.headers.get('content-type')
  }

  if (response.ok && body && body.challenge_type !== 'redirect') {
    entraLogger.info({ entra }, `Entra ${step} succeeded`)
  } else if (body?.error || body?.challenge_type === 'redirect') {
    entraLogger.warn(
      { entra },
      `Entra ${step} returned ${body.error ?? 'redirect'}`
    )
  } else {
    entraLogger.error(
      { entra },
      `Entra ${step} returned an unexpected response`
    )
  }
}

function classifyError(body) {
  if (body?.error === 'expired_token') {
    return signInFailure.expired
  }
  // Both mean "wrong email or password"; kept identical to avoid revealing which accounts exist.
  if (
    body?.error === 'user_not_found' ||
    (body?.error === 'invalid_grant' && !body.suberror)
  ) {
    return signInFailure.invalidCredentials
  }
  if (body?.suberror === 'invalid_oob_value') {
    return signInFailure.invalidCode
  }
  if (BROWSER_REQUIRED_SUBERRORS.has(body?.suberror)) {
    return signInFailure.browserRequired
  }
  return signInFailure.unavailable
}

/** POSTs a form to an Entra native-auth or token endpoint and returns the JSON body. */
export async function post(
  path,
  fields,
  { base = authorityBase(), stepPrefix = '' } = {}
) {
  const name = `${stepPrefix}${path}`
  const step = fields.grant_type ? `${name}:${fields.grant_type}` : name
  const startedAt = Date.now()
  let response
  try {
    response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: new URLSearchParams({
        client_id: entraSettings().clientId,
        ...fields
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  } catch (error) {
    entraLogger.error(
      {
        entra: {
          step,
          durationMs: Date.now() - startedAt,
          errorName: error?.name,
          causeCode: error?.cause?.code,
          causeMessage: error?.cause?.message ?? error?.message
        }
      },
      `Entra ${step} request failed to reach Entra`
    )
    throw new EntraSignInError(signInFailure.unavailable)
  }

  const body = await response.json().catch(() => null)
  logEntraResponse(step, response, body, Date.now() - startedAt)

  if (body?.challenge_type === 'redirect') {
    throw new EntraSignInError(signInFailure.browserRequired, body)
  }

  if (response.ok && body) {
    return body
  }

  throw new EntraSignInError(classifyError(body), body)
}
