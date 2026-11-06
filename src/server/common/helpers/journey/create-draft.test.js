import { config } from '#/config/config.js'
import { getJourneyState } from './navigation.js'
import { ensureCatchRecordDraft, prepareDraftCreation } from './create-draft.js'
import {
  mockCatchRecording,
  restoreCatchRecordingMock,
  CREATED_DRAFT
} from '#/test-helpers/mock-catch-recording.js'

function requestWith(state = {}) {
  return {
    yar: {
      get: () => state,
      set: (_key, value) => {
        state = value
      }
    }
  }
}

beforeEach(() => mockCatchRecording())
afterEach(() => restoreCatchRecordingMock())

describe('Draft journey integration', () => {
  test('Should prepare a stable creation key before calling the API', () => {
    const request = requestWith()
    prepareDraftCreation(request)
    const key = getJourneyState(request).draftCreationKey
    expect(key).toMatch(/^[a-f0-9-]{36}$/)
    prepareDraftCreation(request)
    expect(getJourneyState(request).draftCreationKey).toBe(key)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  test('Should store the created draft ID, reference and version without losing other journey fields', async () => {
    const request = requestWith({ tripSameDate: true })
    expect(await ensureCatchRecordDraft(request, { id: 'vessel-id' })).toBe(
      true
    )
    expect(getJourneyState(request)).toMatchObject({
      catchRecordId: CREATED_DRAFT.id,
      reference: CREATED_DRAFT.catchRecordReference,
      version: 1,
      draftVesselId: 'vessel-id',
      tripSameDate: true
    })
    await ensureCatchRecordDraft(request, { id: 'vessel-id' })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  test('Should retain the vessel and retry key on failure and reuse them on retry', async () => {
    const request = requestWith()
    globalThis.fetch.mockRejectedValueOnce(new Error('network error'))
    await expect(
      ensureCatchRecordDraft(request, { id: 'vessel-id' })
    ).rejects.toThrow()
    const state = getJourneyState(request)
    expect(state).not.toHaveProperty('catchRecordId')
    expect(state.draftVesselId).toBe('vessel-id')
    await ensureCatchRecordDraft(request, { id: 'vessel-id' })
    expect(
      globalThis.fetch.mock.calls.map(
        ([, options]) => options.headers['Idempotency-Key']
      )
    ).toEqual([state.draftCreationKey, state.draftCreationKey])
  })

  test.each([
    { catchRecordId: 'existing-id', selectedVesselId: 'first-vessel' },
    { draftVesselId: 'first-vessel', draftCreationKey: 'pending-key' }
  ])(
    'Should block a vessel change for an existing or uncertain draft: %j',
    async (state) => {
      const request = requestWith(state)
      expect(
        await ensureCatchRecordDraft(request, { id: 'other-vessel' })
      ).toBe(false)
      expect(getJourneyState(request)).toEqual(state)
      expect(globalThis.fetch).not.toHaveBeenCalled()
    }
  )

  test('Should not prepare a new key for an existing draft', () => {
    const request = requestWith({ catchRecordId: 'existing-id' })
    prepareDraftCreation(request)
    expect(getJourneyState(request)).not.toHaveProperty('draftCreationKey')
  })

  test('Should refuse mock authentication outside approved environments', async () => {
    config.set('catchRecording.environment', 'prod')
    await expect(
      ensureCatchRecordDraft(requestWith(), { id: 'vessel-id' })
    ).rejects.toMatchObject({ output: { statusCode: 503 } })
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})
