import {
  minimumRectangleCount,
  defaultRectangleCount,
  maximumRectangleCount
} from './statistical-area-map-constants.js'
import { drawPorts } from './statistical-area-map-ports.js'
import { drawMapLayers } from './statistical-area-map-layers.js'
import {
  boundsIntersect,
  viewportForCellGrid,
  closestSubrectangles,
  spanOf
} from './statistical-area-map-geometry.js'

const webMercatorCrsPattern = /3857|900913/i
const RADIANS_TO_DEGREES = 180 / Math.PI

export function resizeCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1
  const bounds = canvas.getBoundingClientRect()
  canvas.width = Math.max(1, Math.round(bounds.width * ratio))
  canvas.height = Math.max(1, Math.round(bounds.height * ratio))
}

function boundsForCoordinates(coordinates) {
  const points = coordinates.flat(1)
  return points.reduce(
    (bounds, [longitude, latitude]) => ({
      minLongitude: Math.min(bounds.minLongitude, longitude),
      maxLongitude: Math.max(bounds.maxLongitude, longitude),
      minLatitude: Math.min(bounds.minLatitude, latitude),
      maxLatitude: Math.max(bounds.maxLatitude, latitude)
    }),
    {
      minLongitude: Infinity,
      maxLongitude: -Infinity,
      minLatitude: Infinity,
      maxLatitude: -Infinity
    }
  )
}

function isValidRing(ring) {
  return (
    Array.isArray(ring) &&
    ring.length >= 4 &&
    ring.every(
      (coordinate) =>
        Array.isArray(coordinate) &&
        Number.isFinite(coordinate[0]) &&
        Number.isFinite(coordinate[1])
    )
  )
}

function toLandPolygon(rings) {
  if (!Array.isArray(rings) || !isValidRing(rings[0])) {
    return undefined
  }
  return { exterior: rings[0], holes: rings.slice(1).filter(isValidRing) }
}

function polygonCoordinatesForGeometry(geometry) {
  if (geometry?.type === 'Polygon') {
    return [geometry.coordinates]
  }
  if (geometry?.type === 'MultiPolygon') {
    return geometry.coordinates
  }
  return []
}

function toWgs84Coordinate([easting, northing, ...remaining]) {
  const earthRadiusMetres = 6378137
  const longitude = (easting / earthRadiusMetres) * RADIANS_TO_DEGREES
  const latitude =
    (2 * Math.atan(Math.exp(northing / earthRadiusMetres)) - Math.PI / 2) *
    RADIANS_TO_DEGREES
  return [longitude, latitude, ...remaining]
}

function transformCoordinatesToWgs84(coordinates) {
  if (
    Array.isArray(coordinates) &&
    coordinates.length >= 2 &&
    Number.isFinite(coordinates[0]) &&
    Number.isFinite(coordinates[1])
  ) {
    return toWgs84Coordinate(coordinates)
  }
  return Array.isArray(coordinates)
    ? coordinates.map(transformCoordinatesToWgs84)
    : coordinates
}

export function mapLandGeoJsonToCanvasData(featureCollection) {
  if (
    featureCollection?.type !== 'FeatureCollection' ||
    !Array.isArray(featureCollection.features)
  ) {
    return undefined
  }
  const land = featureCollection.features.flatMap((feature) => {
    const polygonCoordinates = polygonCoordinatesForGeometry(feature.geometry)
    const polygons = polygonCoordinates.map(toLandPolygon).filter(Boolean)
    if (polygons.length === 0) {
      return []
    }
    const allCoordinates = polygons.flatMap((polygon) => [
      polygon.exterior,
      ...polygon.holes
    ])
    return [{ polygons, bounds: boundsForCoordinates(allCoordinates) }]
  })
  return land.length > 0 ? land : undefined
}

function mapFeatureToCanvasSubrectangle(feature, usesWebMercator) {
  const properties = feature.properties || {}
  const code = properties.code || properties.sub_code
  const isSubrectangle =
    properties.areaType === 'ices-subrectangle' ||
    (typeof properties.sub_code === 'string' && properties.sub_code.length > 0)
  if (!isSubrectangle || typeof code !== 'string') {
    return undefined
  }
  const geometry = usesWebMercator
    ? {
        ...feature.geometry,
        coordinates: transformCoordinatesToWgs84(feature.geometry?.coordinates)
      }
    : feature.geometry
  const polygons = polygonCoordinatesForGeometry(geometry)
    .map(toLandPolygon)
    .filter(Boolean)
  if (polygons.length === 0) {
    return undefined
  }
  const coordinates = polygons.flatMap((polygon) => [
    polygon.exterior,
    ...polygon.holes
  ])
  const bounds = boundsForCoordinates(coordinates)
  const centroid =
    properties.centroid ||
    (Number.isFinite(properties.sub_x) && Number.isFinite(properties.sub_y)
      ? { longitude: properties.sub_x, latitude: properties.sub_y }
      : undefined)

  return {
    subCode: code.toUpperCase(),
    polygons,
    bounds,
    labelCoordinate:
      Number.isFinite(centroid?.longitude) &&
      Number.isFinite(centroid?.latitude)
        ? [centroid.longitude, centroid.latitude]
        : [
            (bounds.minLongitude + bounds.maxLongitude) / 2,
            (bounds.minLatitude + bounds.maxLatitude) / 2
          ],
    overlapsSea: properties.overlapsSea !== false
  }
}

export function mapSubrectanglesGeoJsonToCanvasData(featureCollection) {
  if (
    featureCollection?.type !== 'FeatureCollection' ||
    !Array.isArray(featureCollection.features)
  ) {
    return []
  }
  const referenceCrs =
    featureCollection.metadata?.crs ||
    featureCollection.crs?.properties?.name ||
    ''
  const usesWebMercator = webMercatorCrsPattern.test(referenceCrs)
  return featureCollection.features
    .map((feature) => mapFeatureToCanvasSubrectangle(feature, usesWebMercator))
    .filter(Boolean)
}

async function fetchJson(url) {
  try {
    const response = await fetch(url)
    return response.ok ? await response.json() : undefined
  } catch {
    return undefined
  }
}

export async function loadOfflineMapData() {
  const [bundledLand, bundledSubrectangleData, portData, apiSubrectangles] =
    await Promise.all([
      fetchJson('/public/offline-map/land.json'),
      fetchJson('/public/offline-map/subrectangles.json'),
      fetchJson('/public/offline-map/ports.json'),
      fetchJson('/map-data/statistical-areas')
    ])
  if (!portData) {
    return null
  }

  const land = bundledLand?.land
  if (!Array.isArray(land) || land.length === 0) {
    return null
  }
  const apiAreas = mapSubrectanglesGeoJsonToCanvasData(apiSubrectangles)
  const subrectanglesByCode = new Map(
    (bundledSubrectangleData?.subrectangles || []).map((area) => [
      area.subCode,
      area
    ])
  )
  for (const area of apiAreas) {
    const bundledArea = subrectanglesByCode.get(area.subCode)
    if (bundledArea && !boundsIntersect(bundledArea.bounds, area.bounds)) {
      continue
    }
    subrectanglesByCode.set(area.subCode, {
      ...bundledArea,
      ...area,
      overlapsSea: bundledArea?.overlapsSea ?? area.overlapsSea
    })
  }
  const allSubrectangles = [...subrectanglesByCode.values()]
  const { ports } = portData
  // A rectangle entirely on land has no fishing area and must never be shown, selectable or not.
  const subrectangles = allSubrectangles.filter(
    (subrectangle) => subrectangle.overlapsSea
  )
  if (subrectangles.length === 0) {
    return null
  }

  return { land, subrectangles, ports }
}

export function findDeparturePort(ports, map) {
  let coordinate
  try {
    coordinate = JSON.parse(map.dataset.departurePortCoordinate || 'null')
  } catch {
    coordinate = null
  }
  if (
    Array.isArray(coordinate) &&
    coordinate.length === 2 &&
    coordinate.every(Number.isFinite)
  ) {
    return { name: map.dataset.departurePort, coordinate }
  }
  return ports.find(
    (port) =>
      port.name.toLowerCase() === map.dataset.departurePort.toLowerCase()
  )
}

export function findDepartureCell(subrectangles, departurePort) {
  const containingCell = subrectangles.find(
    (subrectangle) =>
      departurePort.coordinate[0] >= subrectangle.bounds.minLongitude &&
      departurePort.coordinate[0] <= subrectangle.bounds.maxLongitude &&
      departurePort.coordinate[1] >= subrectangle.bounds.minLatitude &&
      departurePort.coordinate[1] <= subrectangle.bounds.maxLatitude
  )
  return (
    containingCell ||
    closestSubrectangles(subrectangles, departurePort.coordinate, 1)[0]
  )
}

// Zoom is continuous between the 4-rectangle (most zoomed in) and 16-rectangle (most zoomed
// out) grid blocks, opening on the 9-rectangle default - mirroring MapKit's `CameraZoomRange`.
export function computeZoomExtents(
  subrectangles,
  departureCell,
  portCoordinate,
  canvas
) {
  const maximumZoomOutExtent = viewportForCellGrid(
    subrectangles,
    departureCell,
    portCoordinate,
    maximumRectangleCount,
    canvas
  )
  const defaultZoomExtent = viewportForCellGrid(
    subrectangles,
    departureCell,
    portCoordinate,
    defaultRectangleCount,
    canvas
  )
  const maximumZoomInExtent = viewportForCellGrid(
    subrectangles,
    departureCell,
    portCoordinate,
    minimumRectangleCount,
    canvas
  )

  return {
    maximumZoomOutExtent,
    defaultZoomExtent,
    minSpan: spanOf(maximumZoomInExtent),
    maxSpan: spanOf(maximumZoomOutExtent)
  }
}

export function createRender({
  canvas,
  land,
  subrectangles,
  ports,
  departurePort,
  state
}) {
  return () => {
    const context = canvas.getContext('2d')
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)

    drawMapLayers(context, {
      subrectangles,
      land,
      viewport: state.viewport,
      canvas,
      selectedCode: state.selectedSubCode
    })
    drawPorts(context, ports, land, departurePort, state.viewport, canvas)
  }
}
