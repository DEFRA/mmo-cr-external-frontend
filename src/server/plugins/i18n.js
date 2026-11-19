import { config } from '#/config/config.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import {
  defaultLanguage,
  isSupportedLanguage,
  runWithLanguage
} from '#/server/common/helpers/i18n/language-context.js'
import { translate } from '#/server/common/helpers/i18n/translator.js'

export const LANGUAGE_COOKIE = 'lang'
const MS_PER_DAY = 86_400_000
const LANGUAGE_COOKIE_TTL_DAYS = 365
const LANGUAGE_COOKIE_TTL_MS = LANGUAGE_COOKIE_TTL_DAYS * MS_PER_DAY

// Runs a private request stage inside the request's language store. `_reply` is wrapped as
// well as `_lifecycle` because views are rendered during transmission, after the lifecycle ends
// (the same technique @defra/hapi-tracing uses for its trace id store).
function wrapStage(request, stage, store) {
  const original = request[stage].bind(request)
  request[stage] = (...args) => runWithLanguage(store, () => original(...args))
}

function pathWithoutLanguage(request) {
  const params = new URLSearchParams(request.url.search)
  params.delete('lang')
  const search = params.toString()
  return search ? `${request.path}?${search}` : request.path
}

// Read straight from the header: hapi only parses cookies after onRequest, and skips later
// stages for unmatched routes, but 404 pages still need the user's language.
function savedLanguage(request) {
  const match = /(?:^|;\s*)lang=([^;]*)/.exec(request.headers.cookie ?? '')
  return match?.[1]
}

function resolveLanguage(request) {
  const requested = request.query?.lang
  if (isSupportedLanguage(requested)) {
    return { lang: requested, isSwitch: true }
  }

  const saved = savedLanguage(request)
  return {
    lang: isSupportedLanguage(saved) ? saved : defaultLanguage(),
    isSwitch: false
  }
}

export const i18n = {
  plugin: {
    name: 'i18n',
    register(server) {
      server.state(LANGUAGE_COOKIE, {
        ttl: LANGUAGE_COOKIE_TTL_MS,
        path: '/',
        encoding: 'none',
        isSecure: config.get('session.cookie.secure'),
        isHttpOnly: true,
        isSameSite: 'Lax',
        clearInvalid: true,
        strictHeader: false
      })

      server.decorate(
        'request',
        't',
        (request) => (key, params) =>
          translate(request.app.lang ?? defaultLanguage(), key, params),
        { apply: true }
      )

      server.ext('onRequest', (request, h) => {
        const { lang, isSwitch } = resolveLanguage(request)
        const store = { lang }
        request.app.lang = lang
        request.app.isLanguageSwitch = isSwitch
        wrapStage(request, '_lifecycle', store)
        wrapStage(request, '_reply', store)
        return h.continue
      })

      // The switch redirect waits for onPreAuth so it only applies to real routes.
      server.ext('onPreAuth', (request, h) => {
        const { lang, isLanguageSwitch } = request.app

        if (isLanguageSwitch && request.method === 'get') {
          return h
            .redirect(pathWithoutLanguage(request))
            .code(statusCodes.found)
            .state(LANGUAGE_COOKIE, lang)
            .takeover()
        }

        return h.continue
      })
    }
  }
}
