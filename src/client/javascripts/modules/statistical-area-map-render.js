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
  viewportForCellGrid,
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

export async function loadOfflineMapData() {
  const [landResponse, subrectangleResponse, portResponse] = await Promise.all([
    fetch('/public/offline-map/land.json'),
    fetch('/public/offline-map/subrectangles.json'),
    fetch('/public/offline-map/ports.json')
  ])
  if (
    ![landResponse, subrectangleResponse, portResponse].every(
      (response) => response.ok
    )
  ) {
    return null
  }

  const [{ land }, { subrectangles: allSubrectangles }, { ports }] =
    await Promise.all([
      landResponse.json(),
      subrectangleResponse.json(),
      portResponse.json()
    ])
  // A rectangle entirely on land has no fishing area and must never be shown, selectable or not.
  const subrectangles = allSubrectangles.filter(
    (subrectangle) => subrectangle.overlapsSea
  )

  return { land, subrectangles, ports }
}

export function findDeparturePort(ports, map) {
  return ports.find(
    (port) =>
      port.name.toLowerCase() === map.dataset.departurePort.toLowerCase()
  )
}

export function findDepartureCell(subrectangles, departurePort) {
  return subrectangles.find(
    (subrectangle) =>
      departurePort.coordinate[0] >= subrectangle.bounds.minLongitude &&
      departurePort.coordinate[0] <= subrectangle.bounds.maxLongitude &&
      departurePort.coordinate[1] >= subrectangle.bounds.minLatitude &&
      departurePort.coordinate[1] <= subrectangle.bounds.maxLatitude
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
    const isSelected = subrectangle.subCode === selectedSubCode
    context.fillStyle = isSelected
      ? 'rgba(232, 166, 58, 0.35)'
      : 'rgba(11, 107, 58, 0.06)'
    context.strokeStyle = isSelected ? '#E8A63A' : '#0B6B3A'
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

function drawSubrectangleLabels(context, subrectangles, viewport, canvas) {
  context.fillStyle = '#1d1d1d'
  context.font = `${Math.max(minimumLabelFontSize, canvas.width / fontSizeCanvasWidthDivisor)}px sans-serif`
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

      const [x, y] = toScreen(
        clampPointToBounds(subrectangle.labelCoordinate, visible),
        viewport,
        canvas
      )
      context.fillText(subrectangle.subCode, x + 4, y - 4)
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

export function createRender({
  canvas,
  land,
  subrectangles,
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
    drawSubrectangleLabels(context, subrectangles, state.viewport, canvas)
    drawDeparturePortMarker(context, departurePort, state.viewport, canvas)
  }
}
