import { config } from '#/config/config.js'

export const CREATED_DRAFT = {
  id: '00000000-0000-4000-8000-000000000101',
  catchRecordReference: 'A1234520261029172000',
  version: 1,
  status: 'DRAFT'
}

export const RETRIEVED_DRAFT = {
  ...CREATED_DRAFT,
  displayStatus: 'Draft',
  completedSections: ['pairFishing'],
  incompleteSections: ['trip', 'gears'],
  progress: {
    hasUnsubmittedChanges: true,
    numberOfSubmissions: 0,
    incompleteGearAssociationIds: ['gear-association-1'],
    currentIncompleteGearAssociationId: 'gear-association-1',
    allGearsComplete: false
  },
  sectionCompletion: { trip: false, pairFishing: true, gears: false },
  submissionEligible: false
}

let original

export function mockCatchRecording() {
  original = config.get('catchRecording')
  config.set(
    'catchRecording.serviceUrl',
    'https://catch-recording.test/catch-recording-service'
  )
  config.set('catchRecording.token', 'test-caller-token')
  config.set('catchRecording.environment', 'test')
  const previousFetch = globalThis.fetch
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options) => {
      const { pathname } = new URL(url)
      if (pathname.endsWith(`/v1/catch-records/${CREATED_DRAFT.id}`)) {
        return Promise.resolve({
          status: 200,
          json: async () => ({ ...RETRIEVED_DRAFT })
        })
      }
      if (pathname.endsWith('/v1/catch-records')) {
        return Promise.resolve({
          status: 201,
          json: async () => ({ ...CREATED_DRAFT })
        })
      }
      return previousFetch(url, options)
    })
  )
}

export function restoreCatchRecordingMock() {
  config.set('catchRecording', original)
  vi.unstubAllGlobals()
}
