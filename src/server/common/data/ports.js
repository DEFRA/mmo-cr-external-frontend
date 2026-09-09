// Real bundled UK ports - the same ports.geojson-derived list the offline statistical-area map
// uses (src/client/public/offline-map/ports.json), and the same source data the iOS app's
// BundledPortSearchProvider searches (see mmo-cr-ios PortSearchProvider.swift). A handful of
// names repeat in the source data (distinct piers/slipways sharing a port name); those collapse
// to a single option here, keyed by a stable slug of the name, keeping the first occurrence -
// mirrors BundledPortSearchProvider's own dedupe (there, by port_code instead, since this data
// has no simple code of its own).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const portsJsonPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../client/public/offline-map/ports.json'
)

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function loadPorts() {
  const { ports: realPorts } = JSON.parse(readFileSync(portsJsonPath, 'utf8'))
  const seenCodes = new Set()
  const deduplicated = []

  for (const { name } of realPorts) {
    const code = slugify(name)
    if (seenCodes.has(code)) continue
    seenCodes.add(code)
    deduplicated.push({ code, name })
  }

  return deduplicated.sort((first, second) => first.name.localeCompare(second.name))
}

export const ports = loadPorts()

