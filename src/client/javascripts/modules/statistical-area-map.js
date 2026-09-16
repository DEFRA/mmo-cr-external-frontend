const minimumRectangleCount = 4
const defaultRectangleCount = 9
const maximumRectangleCount = 16
const selectedGridLineWidth = 3
const minimumLabelFontSize = 12
const fontSizeCanvasWidthDivisor = 90
const portMarkerRadius = 5
const dragThresholdPixels = 5

function boundsIntersect(first, second) {
  return !(
    first.maxLongitude < second.minLongitude ||
    first.minLongitude > second.maxLongitude ||
    first.maxLatitude < second.minLatitude ||
    first.minLatitude > second.maxLatitude
  )
}

// The overlapping region of two bounds - used to keep a label anchored inside whichever part of
// its rectangle is actually on screen, rather than disappearing once the rectangle is cropped.
function intersectBounds(first, second) {
  return {
    minLongitude: Math.max(first.minLongitude, second.minLongitude),
    maxLongitude: Math.min(first.maxLongitude, second.maxLongitude),
    minLatitude: Math.max(first.minLatitude, second.minLatitude),
    maxLatitude: Math.min(first.maxLatitude, second.maxLatitude)
  }
}

function clampPointToBounds([longitude, latitude], bounds) {
  return [
    Math.min(Math.max(longitude, bounds.minLongitude), bounds.maxLongitude),
    Math.min(Math.max(latitude, bounds.minLatitude), bounds.maxLatitude)
  ]
}

function pointIsInRing([longitude, latitude], ring) {
  let isInside = false

  for (
    let index = 0, previousIndex = ring.length - 1;
    index < ring.length;
    previousIndex = index, index++
  ) {
    const [currentLongitude, currentLatitude] = ring[index]
    const [previousLongitude, previousLatitude] = ring[previousIndex]
    const crossesLatitude =
      currentLatitude > latitude !== previousLatitude > latitude
    const intersectionLongitude =
      ((previousLongitude - currentLongitude) * (latitude - currentLatitude)) /
        (previousLatitude - currentLatitude) +
      currentLongitude

    if (crossesLatitude && longitude < intersectionLongitude) {
      isInside = !isInside
    }
  }

  return isInside
}

function containsPoint(point, subrectangle) {
  return subrectangle.polygons.some(
    (polygon) =>
      pointIsInRing(point, polygon.exterior) &&
      !polygon.holes.some((hole) => pointIsInRing(point, hole))
  )
}

// Keeps the departure cell in the block while sitting as close to the port as the grid allows.
function firstBlockOrigin(
  cells,
  cellWidth,
  cellHeight,
  centre,
  portCoordinate
) {
  let firstColumn = 0
  let firstRow = 0
  let closest = Infinity

  for (let column = -(cells - 1); column <= 0; column++) {
    for (let row = -(cells - 1); row <= 0; row++) {
      const blockLongitude =
        centre.longitude + (column + (cells - 1) / 2) * cellWidth
      const blockLatitude =
        centre.latitude + (row + (cells - 1) / 2) * cellHeight
      const distance =
        (blockLongitude - portCoordinate[0]) ** 2 +
        (blockLatitude - portCoordinate[1]) ** 2

      if (distance < closest) {
        closest = distance
        firstColumn = column
        firstRow = row
      }
    }
  }

  return { firstColumn, firstRow }
}

function buildBlockCells(
  subrectangles,
  cells,
  cellWidth,
  cellHeight,
  centre,
  origin
) {
  const block = []

  for (let column = 0; column < cells; column++) {
    for (let row = 0; row < cells; row++) {
      const targetLongitude =
        centre.longitude + (origin.firstColumn + column) * cellWidth
      const targetLatitude =
        centre.latitude + (origin.firstRow + row) * cellHeight
      const neighbour = subrectangles.find(
        (subrectangle) =>
          Math.abs(
            (subrectangle.bounds.minLongitude +
              subrectangle.bounds.maxLongitude) /
              2 -
              targetLongitude
          ) <
            cellWidth / 2 &&
          Math.abs(
            (subrectangle.bounds.minLatitude +
              subrectangle.bounds.maxLatitude) /
              2 -
              targetLatitude
          ) <
            cellHeight / 2
      )
      if (neighbour) {
        block.push(neighbour)
      }
    }
  }

  return block
}

function boundsFromBlock(block) {
  return block.reduce(
    (result, subrectangle) => ({
      minLongitude: Math.min(
        result.minLongitude,
        subrectangle.bounds.minLongitude
      ),
      maxLongitude: Math.max(
        result.maxLongitude,
        subrectangle.bounds.maxLongitude
      ),
      minLatitude: Math.min(
        result.minLatitude,
        subrectangle.bounds.minLatitude
      ),
      maxLatitude: Math.max(result.maxLatitude, subrectangle.bounds.maxLatitude)
    }),
    {
      minLongitude: Infinity,
      maxLongitude: -Infinity,
      minLatitude: Infinity,
      maxLatitude: -Infinity
    }
  )
}

// Expands the shorter axis so the viewport matches the canvas aspect ratio without distorting it.
function fitViewportToCanvasRatio(viewport, canvasRatio) {
  const longitudeSpan = viewport.maxLongitude - viewport.minLongitude
  const latitudeSpan = viewport.maxLatitude - viewport.minLatitude

  if (longitudeSpan / latitudeSpan > canvasRatio) {
    const centre = (viewport.minLatitude + viewport.maxLatitude) / 2
    const span = longitudeSpan / canvasRatio
    viewport.minLatitude = centre - span / 2
    viewport.maxLatitude = centre + span / 2
  } else {
    const centre = (viewport.minLongitude + viewport.maxLongitude) / 2
    const span = latitudeSpan * canvasRatio
    viewport.minLongitude = centre - span / 2
    viewport.maxLongitude = centre + span / 2
  }

  return viewport
}

// Builds the viewport from the real neighbouring rectangles so the grid edges match the source data exactly.
function viewportForCellGrid(
  subrectangles,
  departureCell,
  portCoordinate,
  count,
  canvas
) {
  const cells = Math.sqrt(count)
  const cellWidth =
    departureCell.bounds.maxLongitude - departureCell.bounds.minLongitude
  const cellHeight =
    departureCell.bounds.maxLatitude - departureCell.bounds.minLatitude
  const centre = {
    longitude:
      (departureCell.bounds.minLongitude + departureCell.bounds.maxLongitude) /
      2,
    latitude:
      (departureCell.bounds.minLatitude + departureCell.bounds.maxLatitude) / 2
  }

  const origin = firstBlockOrigin(
    cells,
    cellWidth,
    cellHeight,
    centre,
    portCoordinate
  )
  const block = buildBlockCells(
    subrectangles,
    cells,
    cellWidth,
    cellHeight,
    centre,
    origin
  )
  const viewport = boundsFromBlock(block)

  return fitViewportToCanvasRatio(viewport, canvas.width / canvas.height)
}

function clampViewport(viewport, extent) {
  const longitudeSpan = Math.min(
    viewport.maxLongitude - viewport.minLongitude,
    extent.maxLongitude - extent.minLongitude
  )
  const latitudeSpan = Math.min(
    viewport.maxLatitude - viewport.minLatitude,
    extent.maxLatitude - extent.minLatitude
  )
  const longitudeCentre = (viewport.minLongitude + viewport.maxLongitude) / 2
  const latitudeCentre = (viewport.minLatitude + viewport.maxLatitude) / 2
  const minLongitude = Math.max(
    extent.minLongitude,
    Math.min(
      extent.maxLongitude - longitudeSpan,
      longitudeCentre - longitudeSpan / 2
    )
  )
  const minLatitude = Math.max(
    extent.minLatitude,
    Math.min(
      extent.maxLatitude - latitudeSpan,
      latitudeCentre - latitudeSpan / 2
    )
  )

  return {
    minLongitude,
    maxLongitude: minLongitude + longitudeSpan,
    minLatitude,
    maxLatitude: minLatitude + latitudeSpan
  }
}

function spanOf(viewport) {
  return {
    longitude: viewport.maxLongitude - viewport.minLongitude,
    latitude: viewport.maxLatitude - viewport.minLatitude
  }
}

// Continuous, hard-clamped zoom around a map coordinate: the span can never shrink past
// `minSpan` (most zoomed in) or grow past `maxSpan` (most zoomed out), mirroring MapKit's
// `CameraZoomRange` enforcement rather than snapping between fixed steps.
function zoomViewport(viewport, scale, anchor, minSpan, maxSpan, panExtent) {
  const span = spanOf(viewport)
  const longitudeSpan = Math.min(
    Math.max(span.longitude * scale, minSpan.longitude),
    maxSpan.longitude
  )
  const latitudeSpan = Math.min(
    Math.max(span.latitude * scale, minSpan.latitude),
    maxSpan.latitude
  )
  const longitudeRatio = (anchor[0] - viewport.minLongitude) / span.longitude
  const latitudeRatio = (anchor[1] - viewport.minLatitude) / span.latitude
  const minLongitude = anchor[0] - longitudeRatio * longitudeSpan
  const minLatitude = anchor[1] - latitudeRatio * latitudeSpan

  return clampViewport(
    {
      minLongitude,
      maxLongitude: minLongitude + longitudeSpan,
      minLatitude,
      maxLatitude: minLatitude + latitudeSpan
    },
    panExtent
  )
}

function toScreen([longitude, latitude], viewport, canvas) {
  return [
    ((longitude - viewport.minLongitude) /
      (viewport.maxLongitude - viewport.minLongitude)) *
      canvas.width,
    ((viewport.maxLatitude - latitude) /
      (viewport.maxLatitude - viewport.minLatitude)) *
      canvas.height
  ]
}

function toCoordinate([x, y], viewport, canvas) {
  return [
    viewport.minLongitude +
      (x / canvas.width) * (viewport.maxLongitude - viewport.minLongitude),
    viewport.maxLatitude -
      (y / canvas.height) * (viewport.maxLatitude - viewport.minLatitude)
  ]
}

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

function resizeCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1
  const bounds = canvas.getBoundingClientRect()
  canvas.width = Math.max(1, Math.round(bounds.width * ratio))
  canvas.height = Math.max(1, Math.round(bounds.height * ratio))
}

function distanceSquared(first, second) {
  return (first[0] - second[0]) ** 2 + (first[1] - second[1]) ** 2
}

export function closestSubrectangles(subrectangles, portCoordinate, count) {
  return subrectangles
    .toSorted(
      (first, second) =>
        distanceSquared(first.labelCoordinate, portCoordinate) -
        distanceSquared(second.labelCoordinate, portCoordinate)
    )
    .slice(0, count)
}

const zoomStep = 1.08
const minimumLabelSpan = 28

async function loadOfflineMapData() {
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
    return undefined
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

function findDeparturePort(ports, map) {
  return ports.find(
    (port) =>
      port.name.toLowerCase() === map.dataset.departurePort.toLowerCase()
  )
}

function findDepartureCell(subrectangles, departurePort) {
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
function computeZoomExtents(
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

function createRender({ canvas, land, subrectangles, departurePort, state }) {
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

function createClientPointToMap(canvas, state) {
  return (clientX, clientY) => {
    const bounds = canvas.getBoundingClientRect()
    return toCoordinate(
      [
        (clientX - bounds.left) * (canvas.width / bounds.width),
        (clientY - bounds.top) * (canvas.height / bounds.height)
      ],
      state.viewport,
      canvas
    )
  }
}

function createSelect({
  subrectangles,
  input,
  status,
  form,
  state,
  clientPointToMap,
  render
}) {
  return (event) => {
    const point = clientPointToMap(event.clientX, event.clientY)
    const selected = subrectangles.find(
      (subrectangle) =>
        boundsIntersect(subrectangle.bounds, {
          minLongitude: point[0],
          maxLongitude: point[0],
          minLatitude: point[1],
          maxLatitude: point[1]
        }) && containsPoint(point, subrectangle)
    )

    state.selectedSubCode = selected?.subCode
    input.value = state.selectedSubCode || ''
    input.disabled = !selected
    status.textContent = selected
      ? `${selected.subCode} selected`
      : 'No statistical area selected'
    render()
    if (selected) {
      form.requestSubmit()
    }
  }
}

// Tracks every touch point currently down, keyed by pointerId, so a second finger switches
// seamlessly from single-finger pan to two-finger pinch-zoom (and back again on lift) - mouse
// interaction only ever has one pointer, so it always takes the single-finger pan path.
function pointFor(event) {
  return { x: event.clientX, y: event.clientY }
}

function pointDistance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y)
}

function midpoint(first, second) {
  return [(first.x + second.x) / 2, (first.y + second.y) / 2]
}

function handlePointerDown(event, canvas, dragState, state, clientPointToMap) {
  try {
    canvas.setPointerCapture(event.pointerId)
  } catch {
    // Some browsers reject capture for a pointer that's already gone - safe to ignore.
  }
  dragState.activePointers.set(event.pointerId, pointFor(event))

  if (dragState.activePointers.size === 1) {
    dragState.hadMultiTouch = false
    dragState.activeDragId = event.pointerId
    dragState.dragOrigin = [event.clientX, event.clientY]
    dragState.dragStart = dragState.dragOrigin
  } else if (dragState.activePointers.size === 2) {
    dragState.hadMultiTouch = true
    dragState.activeDragId = undefined
    const [first, second] = [...dragState.activePointers.values()]
    dragState.pinchStartDistance = pointDistance(first, second)
    dragState.pinchStartViewport = { ...state.viewport }
    dragState.pinchAnchor = clientPointToMap(...midpoint(first, second))
  } else {
    // A third (or later) simultaneous pointer isn't supported - ignored, leaving the
    // existing single-finger pan or two-finger pinch gesture (if any) unaffected.
  }
}

function handlePinchMove(dragState, state, extents, render) {
  const [first, second] = [...dragState.activePointers.values()]
  const distance = pointDistance(first, second)
  if (distance === 0) {
    return
  }
  state.viewport = zoomViewport(
    dragState.pinchStartViewport,
    dragState.pinchStartDistance / distance,
    dragState.pinchAnchor,
    extents.minSpan,
    extents.maxSpan,
    extents.maximumZoomOutExtent
  )
  render()
}

function handlePanMove(event, canvas, dragState, state, extents, render) {
  const longitudeOffset =
    ((event.clientX - dragState.dragStart[0]) *
      (state.viewport.maxLongitude - state.viewport.minLongitude)) /
    canvas.width
  const latitudeOffset =
    ((event.clientY - dragState.dragStart[1]) *
      (state.viewport.maxLatitude - state.viewport.minLatitude)) /
    canvas.height
  state.viewport = clampViewport(
    {
      minLongitude: state.viewport.minLongitude - longitudeOffset,
      maxLongitude: state.viewport.maxLongitude - longitudeOffset,
      minLatitude: state.viewport.minLatitude + latitudeOffset,
      maxLatitude: state.viewport.maxLatitude + latitudeOffset
    },
    extents.maximumZoomOutExtent
  )
  dragState.dragStart = [event.clientX, event.clientY]
  render()
}

function handlePointerMove(event, dragState, state, canvas, extents, render) {
  if (!dragState.activePointers.has(event.pointerId) || event.buttons === 0) {
    return
  }
  dragState.activePointers.set(event.pointerId, pointFor(event))

  if (dragState.activePointers.size === 2 && dragState.pinchStartDistance) {
    handlePinchMove(dragState, state, extents, render)
    return
  }

  if (event.pointerId !== dragState.activeDragId || !dragState.dragStart) {
    return
  }
  handlePanMove(event, canvas, dragState, state, extents, render)
}

function handlePointerEnd(event, dragState, select) {
  dragState.activePointers.delete(event.pointerId)
  dragState.pinchStartDistance = undefined

  if (dragState.activePointers.size === 1) {
    const [remainingId] = [...dragState.activePointers.keys()]
    const remaining = dragState.activePointers.get(remainingId)
    dragState.activeDragId = remainingId
    dragState.dragStart = [remaining.x, remaining.y]
    return
  }

  if (
    dragState.activePointers.size === 0 &&
    event.pointerId === dragState.activeDragId
  ) {
    const wasDrag =
      dragState.dragOrigin &&
      Math.hypot(
        event.clientX - dragState.dragOrigin[0],
        event.clientY - dragState.dragOrigin[1]
      ) > dragThresholdPixels
    dragState.activeDragId = undefined
    dragState.dragStart = undefined
    if (!wasDrag && !dragState.hadMultiTouch) {
      select(event)
    }
  }
}

function handleWheel(event, extents, state, clientPointToMap, render) {
  event.preventDefault()
  const anchor = clientPointToMap(event.clientX, event.clientY)
  const scale = event.deltaY > 0 ? zoomStep : 1 / zoomStep
  state.viewport = zoomViewport(
    state.viewport,
    scale,
    anchor,
    extents.minSpan,
    extents.maxSpan,
    extents.maximumZoomOutExtent
  )
  render()
}

function attachPointerHandlers({
  canvas,
  state,
  extents,
  clientPointToMap,
  render,
  select
}) {
  const dragState = {
    activePointers: new Map(),
    activeDragId: undefined,
    dragOrigin: undefined,
    dragStart: undefined,
    hadMultiTouch: false,
    pinchStartDistance: undefined,
    pinchStartViewport: undefined,
    pinchAnchor: undefined
  }

  canvas.addEventListener('pointerdown', (event) =>
    handlePointerDown(event, canvas, dragState, state, clientPointToMap)
  )
  canvas.addEventListener('pointermove', (event) =>
    handlePointerMove(event, dragState, state, canvas, extents, render)
  )
  const endPointer = (event) => handlePointerEnd(event, dragState, select)
  canvas.addEventListener('pointerup', endPointer)
  canvas.addEventListener('pointercancel', endPointer)
  canvas.addEventListener(
    'wheel',
    (event) => handleWheel(event, extents, state, clientPointToMap, render),
    { passive: false }
  )
}

export async function initialiseStatisticalAreaMap() {
  const map = document.querySelector('[data-statistical-area-map]')
  if (!map) {
    return
  }

  const canvas = map.querySelector('canvas')
  const input = map.querySelector('[data-statistical-area-map-input]')
  const status = map.querySelector('[data-statistical-area-map-status]')
  const form = map.closest('form')

  try {
    const mapData = await loadOfflineMapData()
    if (!mapData) {
      return
    }
    const { land, subrectangles, ports } = mapData

    const departurePort = findDeparturePort(ports, map)
    if (!departurePort) {
      return
    }

    resizeCanvas(canvas)
    const departureCell = findDepartureCell(subrectangles, departurePort)
    if (!departureCell) {
      return
    }

    const extents = computeZoomExtents(
      subrectangles,
      departureCell,
      departurePort.coordinate,
      canvas
    )
    const state = {
      viewport: { ...extents.defaultZoomExtent },
      selectedSubCode: map.dataset.selectedArea
    }

    const clientPointToMap = createClientPointToMap(canvas, state)
    const render = createRender({
      canvas,
      land,
      subrectangles,
      departurePort,
      state
    })
    const select = createSelect({
      subrectangles,
      input,
      status,
      form,
      state,
      clientPointToMap,
      render
    })

    attachPointerHandlers({
      canvas,
      state,
      extents,
      clientPointToMap,
      render,
      select
    })

    render()
  } catch {
    map.hidden = true
  }
}
