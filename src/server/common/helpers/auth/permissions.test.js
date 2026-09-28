import { canAmendRecord } from './permissions.js'

vi.mock('#/server/common/data/get-data.js', () => ({
  getData: vi.fn()
}))

const { getData } = await import('#/server/common/data/get-data.js')

describe('#canAmendRecord', () => {
  test('Should allow amendment for the default vessel owner role', () => {
    getData.mockReturnValue({ role: 'Vessel owner' })
    expect(canAmendRecord()).toBe(true)
  })

  test('Should allow amendment for a helpline agent', () => {
    getData.mockReturnValue({ role: 'Helpline agent' })
    expect(canAmendRecord()).toBe(true)
  })

  test('Should block amendment for an internal user', () => {
    getData.mockReturnValue({ role: 'Internal user' })
    expect(canAmendRecord()).toBe(false)
  })
})
