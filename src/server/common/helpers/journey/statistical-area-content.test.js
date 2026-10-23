import { statisticalAreaContent } from './statistical-area-content.js'
import { getGearCatalogue } from '#/server/common/helpers/gear/favourite-gear.js'

vi.mock('#/server/common/helpers/gear/favourite-gear.js', () => ({
  getGearCatalogue: vi.fn()
}))

describe('#statisticalAreaContent', () => {
  test('Should resolve a selected API gear for an existing session without saved names', async () => {
    vi.mocked(getGearCatalogue).mockResolvedValue([
      { id: 'api-seine', name: 'Seine nets' }
    ])

    const content = await statisticalAreaContent({
      selectedGearIds: ['api-seine'],
      selectedVesselLengthOverallMetres: 8
    })

    expect(content.heading).toBe(
      'Where was the majority of your catch caught using Seine nets?'
    )
    expect(content.pageTitle).toBe(content.heading)
    expect(getGearCatalogue).toHaveBeenCalledWith({ vesselLengthMetres: 8 })
  })

  test.each([
    [{ selectedGearIds: ['pots'] }, ' using Pots'],
    [
      {
        selectedGearIds: ['api-pots'],
        selectedGearNamesById: { 'api-pots': 'Pots' }
      },
      ' using Pots'
    ],
    [{}, '']
  ])(
    'Should reuse known names without a catalogue request for %s',
    async (state, suffix) => {
      const content = await statisticalAreaContent(state)

      expect(content.heading).toBe(
        `Where was the majority of your catch caught${suffix}?`
      )
      expect(getGearCatalogue).not.toHaveBeenCalled()
    }
  )

  test.each([
    [{ selectedGearIds: ['pots'] }, ' using Pots'],
    [{}, '']
  ])('Should use the manual-entry heading for %s', async (state, suffix) => {
    const content = await statisticalAreaContent(state, { manualEntry: true })

    expect(content.heading).toBe(
      `Select the statistical sub area where the majority of your catch was caught${suffix}`
    )
    expect(content.pageTitle).toBe(content.heading)
  })

  test('Should not silently drop a selected gear when reference data is unavailable', async () => {
    vi.mocked(getGearCatalogue).mockRejectedValue(new Error('Unavailable'))

    await expect(
      statisticalAreaContent({ selectedGearIds: ['api-pots'] })
    ).rejects.toThrow('Unavailable')
  })
})
