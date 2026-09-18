// @vitest-environment jsdom
import { vi } from 'vitest'

const createAll = vi.fn()
const initialiseStatisticalAreaMap = vi.fn()
const initialiseStatisticalAreaSearch = vi.fn()
const initialisePortSearch = vi.fn()
const initialiseClearInputErrors = vi.fn()

vi.mock('govuk-frontend', () => ({
  createAll,
  Button: 'Button',
  Checkboxes: 'Checkboxes',
  ErrorSummary: 'ErrorSummary',
  Radios: 'Radios',
  SkipLink: 'SkipLink'
}))
vi.mock('./modules/statistical-area-map.js', () => ({
  initialiseStatisticalAreaMap
}))
vi.mock('./modules/statistical-area-search.js', () => ({
  initialiseStatisticalAreaSearch
}))
vi.mock('./modules/port-search.js', () => ({ initialisePortSearch }))
vi.mock('./clear-input-error.js', () => ({ initialiseClearInputErrors }))

describe('application entry point', () => {
  test('Should initialise every GOV.UK Frontend component and app module', async () => {
    await import('./application.js')

    expect(createAll).toHaveBeenCalledWith('Button')
    expect(createAll).toHaveBeenCalledWith('Checkboxes')
    expect(createAll).toHaveBeenCalledWith('ErrorSummary')
    expect(createAll).toHaveBeenCalledWith('Radios')
    expect(createAll).toHaveBeenCalledWith('SkipLink')
    expect(initialiseStatisticalAreaMap).toHaveBeenCalled()
    expect(initialiseStatisticalAreaSearch).toHaveBeenCalled()
    expect(initialisePortSearch).toHaveBeenCalled()
    expect(initialiseClearInputErrors).toHaveBeenCalled()
  })
})
