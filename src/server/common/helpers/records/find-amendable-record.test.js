import { findAmendableRecord } from './find-amendable-record.js'

vi.mock('#/server/common/data/get-data.js', () => ({
  getData: vi.fn()
}))
vi.mock('#/server/common/helpers/auth/permissions.js', () => ({
  canAmendRecord: vi.fn()
}))

const { getData } = await import('#/server/common/data/get-data.js')
const { canAmendRecord } =
  await import('#/server/common/helpers/auth/permissions.js')

describe('#findAmendableRecord', () => {
  const record = { recordId: 'submitted-1' }

  beforeEach(() => {
    getData.mockReturnValue([record])
  })

  test('Should return the matching record when found and amendment is permitted', () => {
    canAmendRecord.mockReturnValue(true)
    expect(findAmendableRecord('submitted-1')).toBe(record)
  })

  test('Should throw a 404 when no record matches', () => {
    canAmendRecord.mockReturnValue(true)
    expect(() => findAmendableRecord('unknown-1')).toThrow(
      expect.objectContaining({
        output: expect.objectContaining({ statusCode: 404 })
      })
    )
  })

  test('Should throw a 403 when the current user is not permitted to amend', () => {
    canAmendRecord.mockReturnValue(false)
    expect(() => findAmendableRecord('submitted-1')).toThrow(
      expect.objectContaining({
        output: expect.objectContaining({ statusCode: 403 })
      })
    )
  })
})
