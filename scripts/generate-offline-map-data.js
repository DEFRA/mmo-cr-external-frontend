import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDirectory = path.join(rootDirectory, 'data/offline-map/source')
const outputDirectory = path.join(rootDirectory, 'src/client/public/offline-map')
const codesPath = path.join(rootDirectory, 'src/server/common/data/offline-map-subrectangle-codes.js')
const subrectanglesPath = path.join(rootDirectory, 'src/server/common/data/offline-map-subrectangles.js')
const portsPath = path.join(rootDirectory, 'src/server/common/data/offline-map-ports.js')
const webMercatorExtent = 20037508.342789244
const earthRadiusMetres = 6378137
const sampleFractions = [0, 0.25, 0.5, 0.75, 1]

const finiteNumber = (value) => typeof value === 'number' && Number.isFinite(value)

export function numericValue(value) {
  if (finiteNumber(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const number = Number(value)
    return finiteNumber(number) ? number : undefined
  }
}

const validCoordinate = (longitude, latitude) =>
  finiteNumber(longitude) && finiteNumber(latitude) && Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90

export function coordinate(value) {
  if (!Array.isArray(value)) return undefined
  const longitude = numericValue(value[0])
  const latitude = numericValue(value[1])
  if (validCoordinate(longitude, latitude)) return [longitude, latitude]
  if (longitude === undefined || latitude === undefined || Math.abs(longitude) > webMercatorExtent || Math.abs(latitude) > webMercatorExtent) return undefined
  const projectedLongitude = (longitude / earthRadiusMetres) * (180 / Math.PI)
  const projectedLatitude = (2 * Math.atan(Math.exp(latitude / earthRadiusMetres)) - Math.PI / 2) * (180 / Math.PI)
  return validCoordinate(projectedLongitude, projectedLatitude) ? [projectedLongitude, projectedLatitude] : undefined
}

function ring(value) {
  const coordinates = Array.isArray(value) ? value.map(coordinate) : []
  return coordinates.length >= 3 && coordinates.every(Boolean) ? coordinates : undefined
}

function polygon(value) {
  const exterior = ring(value?.[0])
  return exterior ? { exterior, holes: value.slice(1).map(ring).filter(Boolean) } : undefined
}

export function polygons(geometry) {
  const values = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : []
  return Array.isArray(values) ? values.map(polygon).filter(Boolean) : []
}

function points(geometry) {
  const values = geometry?.type === 'Point' ? [geometry.coordinates] : geometry?.type === 'MultiPoint' ? geometry.coordinates : []
  return Array.isArray(values) ? values.map(coordinate).filter(Boolean) : []
}

export function bounds(polygons) {
  const coordinates = polygons.flatMap((polygon) => polygon.exterior)
  if (!coordinates.length) return undefined
  return coordinates.reduce((result, [longitude, latitude]) => ({ minLongitude: Math.min(result.minLongitude, longitude), maxLongitude: Math.max(result.maxLongitude, longitude), minLatitude: Math.min(result.minLatitude, latitude), maxLatitude: Math.max(result.maxLatitude, latitude) }), { minLongitude: Infinity, maxLongitude: -Infinity, minLatitude: Infinity, maxLatitude: -Infinity })
}

const intersects = (first, second) => !(first.maxLongitude < second.minLongitude || first.minLongitude > second.maxLongitude || first.maxLatitude < second.minLatitude || first.minLatitude > second.maxLatitude)

function inRing([longitude, latitude], ring) {
  let inside = false
  for (let index = 0, prior = ring.length - 1; index < ring.length; prior = index++) {
    const [currentLongitude, currentLatitude] = ring[index]
    const [priorLongitude, priorLatitude] = ring[prior]
    if ((currentLatitude > latitude) !== (priorLatitude > latitude) && longitude < ((priorLongitude - currentLongitude) * (latitude - currentLatitude)) / (priorLatitude - currentLatitude) + currentLongitude) inside = !inside
  }
  return inside
}

export const pointInPolygon = (point, polygon) => inRing(point, polygon.exterior) && !polygon.holes.some((hole) => inRing(point, hole))

export function overlapsSea(subrectanglePolygons, landPolygons) {
  const rectangle = bounds(subrectanglePolygons)
  if (!rectangle) return false
  const candidates = landPolygons.filter((land) => intersects(rectangle, land.bounds))
  return !candidates.length || sampleFractions.some((longitudeFraction) => sampleFractions.some((latitudeFraction) => !candidates.some((land) => pointInPolygon([rectangle.minLongitude + (rectangle.maxLongitude - rectangle.minLongitude) * longitudeFraction, rectangle.minLatitude + (rectangle.maxLatitude - rectangle.minLatitude) * latitudeFraction], land))))
}

async function collection(filename) {
  const result = JSON.parse(await readFile(path.join(sourceDirectory, filename), 'utf8'))
  if (result.type !== 'FeatureCollection' || !Array.isArray(result.features)) throw new Error(`${filename} must be a FeatureCollection`)
  return result
}

async function writeIfChanged(filename, content) {
  const destination = path.join(outputDirectory, filename)
  let previous
  try { previous = await readFile(destination, 'utf8') } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (previous !== content) await writeFile(destination, content)
}

export async function generateOfflineMapData() {
  const [landCollection, subrectangleCollection, portCollection] = await Promise.all([collection('map.geojson'), collection('subrectangles.geojson'), collection('ports.geojson')])
  const land = landCollection.features.map((feature) => polygons(feature.geometry)).filter((featurePolygons) => featurePolygons.length).map((featurePolygons) => ({ polygons: featurePolygons, bounds: bounds(featurePolygons) }))
  const landPolygons = land.flatMap((feature) => feature.polygons.map((landPolygon) => ({ ...landPolygon, bounds: bounds([landPolygon]) })))
  const codes = new Set()
  const subrectangles = subrectangleCollection.features.flatMap((feature) => {
    const featurePolygons = polygons(feature.geometry)
    const subCode = feature.properties?.sub_code
    if (!featurePolygons.length) return []
    if (typeof subCode !== 'string' || !subCode || codes.has(subCode)) throw new Error(`Invalid or duplicate sub_code: ${subCode}`)
    codes.add(subCode)
    const rectangle = bounds(featurePolygons)
    return [{ subCode, polygons: featurePolygons, bounds: rectangle, labelCoordinate: [(rectangle.minLongitude + rectangle.maxLongitude) / 2, (rectangle.minLatitude + rectangle.maxLatitude) / 2], overlapsSea: overlapsSea(featurePolygons, landPolygons) }]
  })
  const ports = portCollection.features.flatMap((feature) => points(feature.geometry).map((portCoordinate) => ({ portCode: numericValue(feature.properties?.port_code), name: feature.properties?.port, coordinate: portCoordinate })).filter((port) => typeof port.name === 'string' && port.portCode !== undefined))
  if (!land.length || !subrectangles.length || !ports.length) throw new Error('Offline map generation produced an empty layer')
  await mkdir(outputDirectory, { recursive: true })
  await Promise.all([
    writeIfChanged('land.json', JSON.stringify({ land })),
    writeIfChanged('subrectangles.json', JSON.stringify({ subrectangles })),
    writeIfChanged('ports.json', JSON.stringify({ ports })),
    writeFile(codesPath, `// Generated by scripts/generate-offline-map-data.js. Do not edit.\nexport const offlineMapSubrectangleCodes = new Set(${JSON.stringify([...codes].sort())})\n`),
    writeFile(subrectanglesPath, `// Generated by scripts/generate-offline-map-data.js. Do not edit.\nexport const offlineMapSubrectangles = new Map(${JSON.stringify(subrectangles.map(({ subCode, labelCoordinate }) => [subCode, { coordinate: labelCoordinate, icesRectangle: subCode.slice(0, -1) }]))})\n`),
    writeFile(portsPath, `// Generated by scripts/generate-offline-map-data.js. Do not edit.\nexport const offlineMapPorts = new Map(${JSON.stringify(ports.map(({ name, coordinate }) => [name.toLowerCase(), coordinate]))})\n`)
  ])
  return { land: land.length, subrectangles: subrectangles.length, sea: subrectangles.filter((subrectangle) => subrectangle.overlapsSea).length, ports: ports.length }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateOfflineMapData().then((result) => console.log(`Generated offline map data: ${result.land} land, ${result.subrectangles} subrectangles (${result.sea} sea-overlapping), ${result.ports} ports`)).catch((error) => { console.error(`error: ${error.message}`); process.exitCode = 1 })
}