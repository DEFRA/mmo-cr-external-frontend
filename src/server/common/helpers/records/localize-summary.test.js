import { runWithLanguage } from '#/server/common/helpers/i18n/language-context.js'
import { localizeSummarySections } from './localize-summary.js'

describe('#localizeSummarySections', () => {
  test('Should translate static and coded labels without changing values', () => {
    const summary = [
      {
        heading: 'Trips details',
        rows: [
          {
            key: { text: 'Statistical sub area (Pots)' },
            value: { text: '38E95' }
          },
          {
            key: { text: 'Weight above minimum size retained (COD)' },
            value: { text: '15' }
          },
          { key: { text: 'Species (COD)' }, value: { text: 'Atlantic cod' } }
        ]
      }
    ]

    const localized = runWithLanguage({ lang: 'cy' }, () =>
      localizeSummarySections(summary)
    )

    expect(localized[0].heading).not.toBe('Trips details')
    expect(localized[0].rows[0].key.text).toBe('Is-ardal ystadegol (Pots)')
    expect(localized[0].rows[0].value.text).toBe('38E95')
    expect(localized[0].rows[1].key.text).toBe(
      'Pwysau uwch na’r maint lleiaf a gedwir (COD)'
    )
    expect(localized[0].rows[2].key.text).toBe('Rhywogaeth (COD)')
    expect(localized[0].rows[2].value.text).toBe('Atlantic cod')
  })

  test('Should preserve undefined groups so Nunjucks fallback sections can render', () => {
    expect(localizeSummarySections(undefined)).toBeUndefined()
  })
})
