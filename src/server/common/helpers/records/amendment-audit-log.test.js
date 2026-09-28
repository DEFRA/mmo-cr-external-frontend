import { getAmendmentHistory, recordAmendment } from './amendment-audit-log.js'

describe('#recordAmendment / #getAmendmentHistory', () => {
  test('Should return an empty history for a record with no amendments', () => {
    expect(getAmendmentHistory('never-amended')).toEqual([])
  })

  test('Should record an amendment and return it in that record\u2019s history', () => {
    const entry = {
      recordId: 'submitted-1',
      reason: 'Corrected the recorded weight',
      amendedBy: 'James Smith',
      amendedAt: '2026-09-28T10:00:00.000Z'
    }

    recordAmendment(entry)

    expect(getAmendmentHistory('submitted-1')).toEqual([entry])
  })

  test('Should not return amendments recorded against a different record', () => {
    recordAmendment({
      recordId: 'amended-1',
      reason: 'Fixed the gear type',
      amendedBy: 'James Smith',
      amendedAt: '2026-09-28T11:00:00.000Z'
    })

    expect(
      getAmendmentHistory('amended-1').every(
        (entry) => entry.recordId === 'amended-1'
      )
    ).toBe(true)
  })
})
