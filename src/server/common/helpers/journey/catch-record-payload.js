import { config } from '#/config/config.js'
import { getJourneyState } from './navigation.js'
import {
  tripPayload,
  gearPayload,
  speciesPayload
} from './catch-record-mapping.js'
import { getPortCatalogue } from '#/server/common/helpers/ports/ports-list.js'
import { getGearCatalogue } from '#/server/common/helpers/gear/favourite-gear.js'
import {
  createMapStatisticalAreasReferenceDataClient,
  statisticalAreaReference
} from '#/server/common/clients/map-statistical-areas-reference-data.js'

export function businessDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

export async function sectionData(request, section) {
  const state = getJourneyState(request)
  if (section === 'trip') {
    return tripPayload(state, await getPortCatalogue(), businessDate())
  }
  if (section === 'speciesNotLanded') {
    return speciesPayload(state.speciesNotLanded)
  }
  const areaClient = createMapStatisticalAreasReferenceDataClient({
    serviceUrl: config.get('referenceData.serviceUrl'),
    token: config.get('referenceData.token'),
    timeoutMs: config.get('referenceData.timeoutMs')
  })
  const areaIds = {}
  for (const answers of Object.values(state.catchDetailsByGearId || {})) {
    const code =
      answers.statAreaBranch === 'other'
        ? answers.selectedAlternativeAreaOption === 'other'
          ? answers.alternativeStatisticalArea
          : answers.selectedAlternativeAreaOption
        : answers.selectedStatisticalArea
    if (!code || code === 'other') continue
    if (areaIds[code.toUpperCase()]) continue
    const { body } = await areaClient.getCollection({ code })
    const reference = body.features
      .map(statisticalAreaReference)
      .find((item) => item?.code.toUpperCase() === code.toUpperCase())
    if (reference) areaIds[code.toUpperCase()] = reference.id
  }
  return gearPayload(state, await getGearCatalogue(), areaIds)
}

export async function replacementPayload(request, record) {
  const { enabled, pairVessel, pairSkipperName } = record.pairFishing
  return {
    vessel: { id: record.vessel.id },
    trip: await sectionData(request, 'trip'),
    pairFishing: {
      enabled,
      ...(pairVessel !== undefined ? { pairVessel } : {}),
      ...(pairSkipperName !== undefined ? { pairSkipperName } : {})
    },
    gears: await sectionData(request, 'gears'),
    speciesNotLanded: await sectionData(request, 'speciesNotLanded')
  }
}
