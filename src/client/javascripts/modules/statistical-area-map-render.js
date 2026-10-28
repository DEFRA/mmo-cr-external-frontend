import {
  minimumRectangleCount,
  defaultRectangleCount,
  maximumRectangleCount,
  selectedGridLineWidth,
  minimumLabelFontSize,
  fontSizeCanvasWidthDivisor,
  portMarkerRadius,
  minimumLabelSpan
} from './statistical-area-map-constants.js'
import {
  boundsIntersect,
  intersectBounds,
  clampPointToBounds,
  toScreen,
  toCoordinate,
  containsPoint,
  viewportForCellGrid,
  closestSubrectangles,
  spanOf
} from './statistical-area-map-geometry.js'

function drawPolygon(context, polygon, viewport, canvas) {
  context.beginPath()
  for (const ring of [polygon.exterior, ...polygon.holes]) {
    ring.forEach((coordinate, index) => {
      const [x, y] = toScreen(coordinate, viewport, canvas)
      if (index === 0) {
        context.moveTo(x, y)
      } else {
        context.lineTo(x, y)
      }
    })
    context.closePath()
  }
  context.fill('evenodd')
  context.stroke()
}

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
  const longitude = (easting / earthRadiusMetres) * (180 / Math.PI)
  const latitude =
    (2 * Math.atan(Math.exp(northing / earthRadiusMetres)) - Math.PI / 2) *
    (180 / Math.PI)
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
  const usesWebMercator = /3857|900913/i.test(referenceCrs)

  return featureCollection.features.flatMap((feature) => {
    const properties = feature.properties || {}
    const code = properties.code || properties.sub_code
    const isSubrectangle =
      properties.areaType === 'ices-subrectangle' ||
      (typeof properties.sub_code === 'string' &&
        properties.sub_code.length > 0)
    if (!isSubrectangle || typeof code !== 'string') {
      return []
    }
    const geometry = usesWebMercator
      ? {
          ...feature.geometry,
          coordinates: transformCoordinatesToWgs84(
            feature.geometry?.coordinates
          )
        }
      : feature.geometry
    const polygons = polygonCoordinatesForGeometry(geometry)
      .map(toLandPolygon)
      .filter(Boolean)
    if (polygons.length === 0) {
      return []
    }
    const allCoordinates = polygons.flatMap((polygon) => [
      polygon.exterior,
      ...polygon.holes
    ])
    const bounds = boundsForCoordinates(allCoordinates)
    const centroid =
      properties.centroid ||
      (Number.isFinite(properties.sub_x) && Number.isFinite(properties.sub_y)
        ? { longitude: properties.sub_x, latitude: properties.sub_y }
        : undefined)

    return [
      {
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
        overlapsSea: feature.properties.overlapsSea !== false
      }
    ]
  })
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

function drawSubrectangles(
  context,
  subrectangles,
  viewport,
  canvas,
  selectedSubCode
) {
  // Grid drawn before land so the opaque land fill covers any rectangle that would
  // otherwise overlay it - land areas must stay clean, only the sea portion of a cell
  // should ever show its grid lines/fill. Intersecting (not just fully-contained) cells
  // are drawn so the grid still covers every edge of the viewport.
  for (const subrectangle of subrectangles.filter((feature) =>
    boundsIntersect(feature.bounds, viewport)
  )) {
    const isSelected = subrectangle.subCode === selectedSubCode?.toUpperCase()
    context.fillStyle = isSelected
      ? 'rgba(29, 112, 184, 0.25)'
      : 'rgba(11, 107, 58, 0.06)'
    context.strokeStyle = '#0B6B3A'
    context.lineWidth = isSelected ? selectedGridLineWidth : 1
    subrectangle.polygons.forEach((polygon) =>
      drawPolygon(context, polygon, viewport, canvas)
    )
  }
}

function drawLand(context, land, viewport, canvas) {
  for (const landFeature of land.filter((feature) =>
    boundsIntersect(feature.bounds, viewport)
  )) {
    context.fillStyle = '#0B4143'
    context.strokeStyle = '#000000'
    context.lineWidth = 1
    landFeature.polygons.forEach((polygon) =>
      drawPolygon(context, polygon, viewport, canvas)
    )
  }
}

function landCoverageForLabel(land, bounds, viewport, canvas) {
  const columns = 6
  const rows = 3
  let landSamples = 0

  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const coordinate = toCoordinate(
        [
          bounds.left +
            ((column + 0.5) / columns) * (bounds.right - bounds.left),
          bounds.top + ((row + 0.5) / rows) * (bounds.bottom - bounds.top)
        ],
        viewport,
        canvas
      )
      if (
        land.some(
          (feature) =>
            coordinate[0] >= feature.bounds.minLongitude &&
            coordinate[0] <= feature.bounds.maxLongitude &&
            coordinate[1] >= feature.bounds.minLatitude &&
            coordinate[1] <= feature.bounds.maxLatitude &&
            containsPoint(coordinate, feature)
        )
      ) {
        landSamples += 1
      }
    }
  }

  return landSamples / (columns * rows)
}

function drawSubrectangleLabels(
  context,
  subrectangles,
  land,
  viewport,
  canvas,
  selectedSubCode
) {
  const fontSize = Math.max(
    minimumLabelFontSize,
    canvas.width / fontSizeCanvasWidthDivisor
  )
  context.font = `${fontSize}px sans-serif`
  // A rectangle cropped down to a sliver by the viewport edge is too thin to own a legible,
  // non-overlapping label - skip it rather than let its label spill into the visible neighbour.
  subrectangles
    .filter((subrectangle) => boundsIntersect(subrectangle.bounds, viewport))
    .forEach((subrectangle) => {
      // Clamped to the visible slice of this rectangle so the code stays on screen (and never
      // just vanishes) even once zooming/panning has cropped most of the rectangle out of view.
      const visible = intersectBounds(subrectangle.bounds, viewport)
      const [leftX, topY] = toScreen(
        [visible.minLongitude, visible.maxLatitude],
        viewport,
        canvas
      )
      const [rightX, bottomY] = toScreen(
        [visible.maxLongitude, visible.minLatitude],
        viewport,
        canvas
      )
      if (
        rightX - leftX < minimumLabelSpan ||
        bottomY - topY < minimumLabelSpan
      ) {
        return
      }

      const labelCoordinate = clampPointToBounds(
        subrectangle.labelCoordinate,
        visible
      )
      const [x, y] = toScreen(labelCoordinate, viewport, canvas)
      const isSelected = subrectangle.subCode === selectedSubCode?.toUpperCase()
      const textX = x + 4
      const textY = y - 4
      if (isSelected) {
        const horizontalPadding = 5
        const verticalPadding = 3
        const textWidth = context.measureText(subrectangle.subCode).width
        context.fillStyle = '#1D70B8'
        context.fillRect(
          textX - horizontalPadding,
          textY - fontSize + 2 - verticalPadding,
          textWidth + horizontalPadding * 2,
          fontSize + verticalPadding * 2
        )
        context.fillStyle = '#FFFFFF'
      } else {
        const textWidth = context.measureText(subrectangle.subCode).width
        const landCoverage = landCoverageForLabel(
          land,
          {
            left: textX,
            right: textX + textWidth,
            top: textY - fontSize,
            bottom: textY
          },
          viewport,
          canvas
        )
        context.fillStyle = landCoverage > 0.5 ? '#FFFFFF' : '#1d1d1d'
      }
      context.fillText(subrectangle.subCode, textX, textY)
    })
}

function drawDeparturePortMarker(context, departurePort, viewport, canvas) {
  const [portX, portY] = toScreen(departurePort.coordinate, viewport, canvas)
  context.fillStyle = '#01FEE2'
  context.strokeStyle = '#000000'
  context.lineWidth = 1
  context.beginPath()
  context.arc(portX, portY, portMarkerRadius, 0, Math.PI * 2)
  context.fill()
  context.stroke()
}

function rectanglesOverlap(first, second) {
  const gap = 2
  return (
    first.left < second.right + gap &&
    first.right + gap > second.left &&
    first.top < second.bottom + gap &&
    first.bottom + gap > second.top
  )
}

function drawPorts(context, ports, land, departurePort, viewport, canvas) {
  const fontSize = Math.max(
    minimumLabelFontSize,
    canvas.width / (fontSizeCanvasWidthDivisor + 20)
  )
  context.font = `${fontSize}px sans-serif`
  const visiblePorts = ports.filter(
    ({ coordinate }) =>
      Array.isArray(coordinate) &&
      coordinate.length >= 2 &&
      Number.isFinite(coordinate[0]) &&
      Number.isFinite(coordinate[1]) &&
      coordinate[0] >= viewport.minLongitude &&
      coordinate[0] <= viewport.maxLongitude &&
      coordinate[1] >= viewport.minLatitude &&
      coordinate[1] <= viewport.maxLatitude
  )
  const departureIsVisible = visiblePorts.some(
    (port) =>
      port.name?.toLowerCase() === departurePort.name?.toLowerCase() ||
      (Math.abs(port.coordinate[0] - departurePort.coordinate[0]) < 1e-6 &&
        Math.abs(port.coordinate[1] - departurePort.coordinate[1]) < 1e-6)
  )
  const markerCoordinates = new Set()
  const markerBounds = []

  for (const port of visiblePorts) {
    const [portX, portY] = toScreen(port.coordinate, viewport, canvas)
    const coordinateKey = port.coordinate
      .map((value) => value.toFixed(5))
      .join(',')
    if (markerCoordinates.has(coordinateKey)) {
      continue
    }
    markerCoordinates.add(coordinateKey)
    markerBounds.push({
      left: portX - portMarkerRadius - 2,
      right: portX + portMarkerRadius + 2,
      top: portY - portMarkerRadius - 2,
      bottom: portY + portMarkerRadius + 2
    })

    const isDeparturePort =
      port.name?.toLowerCase() === departurePort.name?.toLowerCase() ||
      (Math.abs(port.coordinate[0] - departurePort.coordinate[0]) < 1e-6 &&
        Math.abs(port.coordinate[1] - departurePort.coordinate[1]) < 1e-6)
    if (isDeparturePort) {
      drawDeparturePortMarker(context, departurePort, viewport, canvas)
      continue
    }

    context.fillStyle = '#01FEE2'
    context.strokeStyle = '#000000'
    context.lineWidth = 1
    context.beginPath()
    context.arc(portX, portY, portMarkerRadius, 0, Math.PI * 2)
    context.fill()
    context.stroke()
  }

  if (!departureIsVisible) {
    drawDeparturePortMarker(context, departurePort, viewport, canvas)
  }

  const labelBounds = [...markerBounds]
  const sortedPorts = visiblePorts.toSorted((first, second) => {
    const distance = (port) =>
      (port.coordinate[0] - departurePort.coordinate[0]) ** 2 +
      (port.coordinate[1] - departurePort.coordinate[1]) ** 2
    const firstIsDeparture =
      first.name?.toLowerCase() === departurePort.name?.toLowerCase()
    const secondIsDeparture =
      second.name?.toLowerCase() === departurePort.name?.toLowerCase()
    if (firstIsDeparture !== secondIsDeparture) {
      return firstIsDeparture ? -1 : 1
    }
    return distance(first) - distance(second)
  })
  const labelledPortNames = new Set()

  for (const port of sortedPorts) {
    if (typeof port.name !== 'string' || port.name.length === 0) {
      continue
    }
    const normalizedName = port.name.trim().toLocaleLowerCase()
    if (!normalizedName || labelledPortNames.has(normalizedName)) {
      continue
    }
    const [portX, portY] = toScreen(port.coordinate, viewport, canvas)
    const paddingX = 4
    const paddingY = 2
    const maxTextWidth = canvas.width - paddingX * 2 - 4
    const textWidth = Math.min(
      context.measureText(port.name).width,
      maxTextWidth
    )
    const labelWidth = textWidth + paddingX * 2
    const labelHeight = fontSize + paddingY * 2
    const candidates = [
      {
        left: portX + portMarkerRadius + 4,
        top: portY - labelHeight / 2
      },
      {
        left: portX - portMarkerRadius - labelWidth - 4,
        top: portY - labelHeight / 2
      },
      {
        left: portX - labelWidth / 2,
        top: portY - portMarkerRadius - labelHeight - 4
      },
      {
        left: portX - labelWidth / 2,
        top: portY + portMarkerRadius + 4
      }
    ]
    const label = candidates.find((candidate) => {
      const bounds = {
        ...candidate,
        right: candidate.left + labelWidth,
        bottom: candidate.top + labelHeight
      }
      return (
        bounds.left >= 2 &&
        bounds.top >= 2 &&
        bounds.right <= canvas.width - 2 &&
        bounds.bottom <= canvas.height - 2 &&
        !labelBounds.some((existing) => rectanglesOverlap(bounds, existing))
      )
    })
    if (!label) {
      continue
    }

    const bounds = {
      ...label,
      right: label.left + labelWidth,
      bottom: label.top + labelHeight
    }
    const labelCoordinate = toCoordinate(
      [label.left + labelWidth / 2, label.top + labelHeight / 2],
      viewport,
      canvas
    )
    const isOnLand = land.some(
      (feature) =>
        labelCoordinate[0] >= feature.bounds.minLongitude &&
        labelCoordinate[0] <= feature.bounds.maxLongitude &&
        labelCoordinate[1] >= feature.bounds.minLatitude &&
        labelCoordinate[1] <= feature.bounds.maxLatitude &&
        containsPoint(labelCoordinate, feature)
    )
    context.fillStyle = isOnLand
      ? 'rgba(11, 65, 67, 0.96)'
      : 'rgba(255, 255, 255, 0.94)'
    context.fillRect(label.left, label.top, labelWidth, labelHeight)
    context.strokeStyle = isOnLand ? '#0B4143' : 'rgba(11, 65, 67, 0.45)'
    context.lineWidth = 1
    context.strokeRect(label.left, label.top, labelWidth, labelHeight)
    context.fillStyle = isOnLand ? '#FFFFFF' : '#0B1F22'
    context.fillText(
      port.name,
      label.left + paddingX,
      label.top + paddingY + fontSize,
      textWidth
    )
    labelBounds.push(bounds)
    labelledPortNames.add(normalizedName)
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

    drawSubrectangles(
      context,
      subrectangles,
      state.viewport,
      canvas,
      state.selectedSubCode
    )
    drawLand(context, land, state.viewport, canvas)
    drawSubrectangleLabels(
      context,
      subrectangles,
      land,
      state.viewport,
      canvas,
      state.selectedSubCode
    )
    drawPorts(context, ports, land, departurePort, state.viewport, canvas)
  }
}
