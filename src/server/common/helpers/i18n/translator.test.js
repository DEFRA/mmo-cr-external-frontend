import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  buildMessages,
  hasTranslation,
  loadCatalog,
  translate
} from './translator.js'
import { runWithLanguage } from './language-context.js'
import { t } from './translator.js'

describe('#translator', () => {
  test('Should translate into Welsh when a Welsh value exists', () => {
    expect(translate('cy', 'common.button.saveAndContinue')).toBe(
      'Cadw a pharhau'
    )
    expect(translate('en', 'common.button.saveAndContinue')).toBe(
      'Save and continue'
    )
  })

  test('Should interpolate named placeholders', () => {
    expect(
      translate('cy', 'common.catchRecordFor', { vesselName: 'OLGA' })
    ).toBe('Cofnod dalfa ar gyfer OLGA')
  })

  test('Should leave a placeholder in place when its value is missing', () => {
    expect(translate('en', 'common.catchRecordFor')).toBe(
      'Catch record for {{vesselName}}'
    )
  })

  test('Should return the key itself for an unknown key', () => {
    expect(translate('cy', 'does.not.exist')).toBe('does.not.exist')
    expect(hasTranslation('does.not.exist')).toBe(false)
  })

  test('Should use the language of the current request', () => {
    expect(t('header.back')).toBe('Back')
    expect(runWithLanguage({ lang: 'cy' }, () => t('header.back'))).toBe(
      'Yn ôl'
    )
  })

  describe('With a temporary catalog', () => {
    let localesDir

    beforeEach(() => {
      localesDir = mkdtempSync(path.join(tmpdir(), 'locales-'))
    })

    afterEach(() => {
      rmSync(localesDir, { recursive: true, force: true })
    })

    test('Should fall back to English when the Welsh value is missing', () => {
      writeFileSync(
        path.join(localesDir, 'a.json'),
        JSON.stringify({
          'x.untranslated': { en: 'English only', cy: { state: 'new' } }
        })
      )

      const messages = buildMessages(loadCatalog(localesDir))

      expect(messages.en['x.untranslated']).toBe('English only')
      expect(messages.cy).not.toHaveProperty('x.untranslated')
    })

    test('Should reject a key defined in two catalog files', () => {
      const entry = { en: 'Text', cy: { value: 'Testun', state: 'new' } }
      writeFileSync(
        path.join(localesDir, 'a.json'),
        JSON.stringify({ 'x.key': entry })
      )
      writeFileSync(
        path.join(localesDir, 'b.json'),
        JSON.stringify({ 'x.key': entry })
      )

      expect(() => loadCatalog(localesDir)).toThrow(
        'Duplicate translation key "x.key" in b.json'
      )
    })
  })
})
