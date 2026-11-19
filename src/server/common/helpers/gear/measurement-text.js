import { t, translate } from '#/server/common/helpers/i18n/translator.js'

// Gear measurement labels and messages arrive in English, from Reference Data or the legacy
// gear catalogue. Text that exactly matches one of these keys' English is shown translated;
// anything else (new Reference Data wording) is shown as received.
const MEASUREMENT_TEXT_KEYS = [
  'catchRecord.gear.measurement.meshSize',
  'catchRecord.gear.measurement.numberOfBeams',
  'catchRecord.gear.measurement.numberOfBeamsOrTrawls',
  'catchRecord.gear.measurement.numberOfDredges',
  'catchRecord.gear.measurement.numberOfTrawlNets',
  'catchRecord.gear.variableMeasurement.hooksHauled',
  'catchRecord.gear.variableMeasurement.hooksLeft',
  'catchRecord.gear.variableMeasurement.netLengthHauled',
  'catchRecord.gear.variableMeasurement.netLengthLeft',
  'catchRecord.gear.variableMeasurement.potsHauled',
  'catchRecord.gear.variableMeasurement.potsLeft',
  'catchRecord.gear.variableMeasurement.rodsAndLines',
  'catchRecord.gear.variableMeasurement.timesShot',
  'gear.measurement.meshSize.empty',
  'gear.measurement.meshSize.invalid',
  'gear.measurement.netLengthHauled.empty',
  'gear.measurement.netLengthHauled.label',
  'gear.measurement.netLengthLeft.empty',
  'gear.measurement.numberOfDredges.empty',
  'gear.measurement.numberOfDredges.invalid',
  'gear.measurement.numberOfTimesShot.empty',
  'gear.measurement.numberOfTimesShot.label',
  'gear.measurement.numberOfTrawlNets.empty',
  'gear.measurement.rodsAndLines.empty',
  'gear.measurement.rodsAndLines.invalid',
  'gear.measurement.rodsAndLines.label',
  'gear.measurement.totalHauled.empty',
  'gear.measurement.totalHauled.invalid',
  'gear.measurement.totalHauled.label',
  'gear.measurement.totalHooksHauled.empty',
  'gear.measurement.totalHooksHauled.invalid',
  'gear.measurement.totalHooksHauled.label',
  'gear.measurement.totalHooksInWater.empty',
  'gear.measurement.totalHooksInWater.invalid',
  'gear.measurement.totalHooksInWater.label',
  'gear.measurement.totalInWater.empty',
  'gear.measurement.totalInWater.invalid',
  'gear.measurement.totalInWater.label'
]

const keyByEnglishText = new Map(
  MEASUREMENT_TEXT_KEYS.map((key) => [translate('en', key), key])
)

export function measurementTextKeys() {
  return [...MEASUREMENT_TEXT_KEYS]
}

export function localizeMeasurementText(text) {
  const key = keyByEnglishText.get(text)
  return key ? t(key) : text
}
