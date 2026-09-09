const minimumRectangleCount = 4
const defaultRectangleCount = 9
const maximumRectangleCount = 16

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
    previousIndex = index++
  ) {
    const [currentLongitude, currentLatitude] = ring[index]
    const [previousLongitude, previousLatitude] = ring[previousIndex]
    const crossesLatitude =
      (currentLatitude > latitude) !== (previousLatitude > latitude)
    const intersectionLongitude =
      ((previousLongitude - currentLongitude) * (latitude - currentLatitude)) /
        (previousLatitude - currentLatitude) +
      currentLongitude

    if (crossesLatitude && longitude < intersectionLongitude) isInside = !isInside
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
  const centreLongitude =
    (departureCell.bounds.minLongitude + departureCell.bounds.maxLongitude) / 2
  const centreLatitude =
    (departureCell.bounds.minLatitude + departureCell.bounds.maxLatitude) / 2

  // Keeps the departure cell in the block while sitting as close to the port as the grid allows.
  let firstColumn = 0
  let firstRow = 0
  let closest = Infinity

  for (let column = -(cells - 1); column <= 0; column++) {
    for (let row = -(cells - 1); row <= 0; row++) {
      const blockLongitude =
        centreLongitude + (column + (cells - 1) / 2) * cellWidth
      const blockLatitude = centreLatitude + (row + (cells - 1) / 2) * cellHeight
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

  const block = []

  for (let column = 0; column < cells; column++) {
    for (let row = 0; row < cells; row++) {
      const targetLongitude =
        centreLongitude + (firstColumn + column) * cellWidth
      const targetLatitude = centreLatitude + (firstRow + row) * cellHeight
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
      if (neighbour) block.push(neighbour)
    }
  }

  const viewport = block.reduce(
    (result, subrectangle) => ({
      minLongitude: Math.min(result.minLongitude, subrectangle.bounds.minLongitude),
      maxLongitude: Math.max(result.maxLongitude, subrectangle.bounds.maxLongitude),
      minLatitude: Math.min(result.minLatitude, subrectangle.bounds.minLatitude),
      maxLatitude: Math.max(result.maxLatitude, subrectangle.bounds.maxLatitude)
    }),
    {
      minLongitude: Infinity,
      maxLongitude: -Infinity,
      minLatitude: Infinity,
      maxLatitude: -Infinity
    }
  )
  const canvasRatio = canvas.width / canvas.height
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
    Math.min(extent.maxLongitude - longitudeSpan, longitudeCentre - longitudeSpan / 2)
  )
  const minLatitude = Math.max(
    extent.minLatitude,
    Math.min(extent.maxLatitude - latitudeSpan, latitudeCentre - latitudeSpan / 2)
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
  const longitudeSpan = Math.min(Math.max(span.longitude * scale, minSpan.longitude), maxSpan.longitude)
  const latitudeSpan = Math.min(Math.max(span.latitude * scale, minSpan.latitude), maxSpan.latitude)
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
      (viewport.maxLongitude - viewport.minLongitude)) * canvas.width,
    ((viewport.maxLatitude - latitude) /
      (viewport.maxLatitude - viewport.minLatitude)) * canvas.height
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
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
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

export async function initialiseStatisticalAreaMap() {
  const map = document.querySelector('[data-statistical-area-map]')
  if (!map) return

  const canvas = map.querySelector('canvas')
  const input = map.querySelector('[data-statistical-area-map-input]')
  const status = map.querySelector('[data-statistical-area-map-status]')
  const form = map.closest('form')

  try {
    const [landResponse, subrectangleResponse, portResponse] = await Promise.all([
      fetch('/public/offline-map/land.json'),
      fetch('/public/offline-map/subrectangles.json'),
      fetch('/public/offline-map/ports.json')
    ])
    if (![landResponse, subrectangleResponse, portResponse].every((response) => response.ok)) return

    const [{ land }, { subrectangles: allSubrectangles }, { ports }] = await Promise.all([
      landResponse.json(),
      subrectangleResponse.json(),
      portResponse.json()
    ])
    // A rectangle entirely on land has no fishing area and must never be shown, selectable or not.
    const subrectangles = allSubrectangles.filter((subrectangle) => subrectangle.overlapsSea)
    const departurePort = ports.find(
      (port) => port.name.toLowerCase() === map.dataset.departurePort.toLowerCase()
    )
    if (!departurePort) return

    resizeCanvas(canvas)
    const departureCell = subrectangles.find(
      (subrectangle) =>
        departurePort.coordinate[0] >= subrectangle.bounds.minLongitude &&
        departurePort.coordinate[0] <= subrectangle.bounds.maxLongitude &&
        departurePort.coordinate[1] >= subrectangle.bounds.minLatitude &&
        departurePort.coordinate[1] <= subrectangle.bounds.maxLatitude
    )
    if (!departureCell) return

    const maximumZoomOutExtent = viewportForCellGrid(
      subrectangles,
      departureCell,
      departurePort.coordinate,
      maximumRectangleCount,
      canvas
    )
    const defaultZoomExtent = viewportForCellGrid(
      subrectangles,
      departureCell,
      departurePort.coordinate,
      defaultRectangleCount,
      canvas
    )
    const maximumZoomInExtent = viewportForCellGrid(
      subrectangles,
      departureCell,
      departurePort.coordinate,
      minimumRectangleCount,
      canvas
    )
    // Zoom is continuous between the 4-rectangle (most zoomed in) and 16-rectangle (most zoomed
    // out) grid blocks, opening on the 9-rectangle default - mirroring MapKit's `CameraZoomRange`.
    const minSpan = spanOf(maximumZoomInExtent)
    const maxSpan = spanOf(maximumZoomOutExtent)
    const zoomStep = 1.08
    let viewport = { ...defaultZoomExtent }
    let selectedSubCode = map.dataset.selectedArea

    const clientPointToMap = (clientX, clientY) => {
      const bounds = canvas.getBoundingClientRect()
      return toCoordinate(
        [(clientX - bounds.left) * (canvas.width / bounds.width), (clientY - bounds.top) * (canvas.height / bounds.height)],
        viewport,
        canvas
      )
    }

    const render = () => {
      const context = canvas.getContext('2d')
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)

      // Grid drawn before land so the opaque land fill covers any rectangle that would
      // otherwise overlay it - land areas must stay clean, only the sea portion of a cell
      // should ever show its grid lines/fill. Intersecting (not just fully-contained) cells
      // are drawn so the grid still covers every edge of the viewport.
      for (const subrectangle of subrectangles.filter((feature) => boundsIntersect(feature.bounds, viewport))) {
        const isSelected = subrectangle.subCode === selectedSubCode
        context.fillStyle = isSelected ? 'rgba(232, 166, 58, 0.35)' : 'rgba(11, 107, 58, 0.06)'
        context.strokeStyle = isSelected ? '#E8A63A' : '#0B6B3A'
        context.lineWidth = isSelected ? 3 : 1
        subrectangle.polygons.forEach((polygon) => drawPolygon(context, polygon, viewport, canvas))
      }

      for (const landFeature of land.filter((feature) => boundsIntersect(feature.bounds, viewport))) {
        context.fillStyle = '#0B4143'
        context.strokeStyle = '#000000'
        context.lineWidth = 1
        landFeature.polygons.forEach((polygon) => drawPolygon(context, polygon, viewport, canvas))
      }

      context.fillStyle = '#1d1d1d'
      context.font = `${Math.max(12, canvas.width / 90)}px sans-serif`
      // A rectangle cropped down to a sliver by the viewport edge is too thin to own a legible,
      // non-overlapping label - skip it rather than let its label spill into the visible neighbour.
      const minimumLabelSpan = 28
      subrectangles
        .filter((subrectangle) => boundsIntersect(subrectangle.bounds, viewport))
        .forEach((subrectangle) => {
          // Clamped to the visible slice of this rectangle so the code stays on screen (and never
          // just vanishes) even once zooming/panning has cropped most of the rectangle out of view.
          const visible = intersectBounds(subrectangle.bounds, viewport)
          const [leftX, topY] = toScreen([visible.minLongitude, visible.maxLatitude], viewport, canvas)
          const [rightX, bottomY] = toScreen([visible.maxLongitude, visible.minLatitude], viewport, canvas)
          if (rightX - leftX < minimumLabelSpan || bottomY - topY < minimumLabelSpan) return

          const [x, y] = toScreen(clampPointToBounds(subrectangle.labelCoordinate, visible), viewport, canvas)
          context.fillText(subrectangle.subCode, x + 4, y - 4)
        })

      const [portX, portY] = toScreen(departurePort.coordinate, viewport, canvas)
      context.fillStyle = '#01FEE2'
      context.strokeStyle = '#000000'
      context.lineWidth = 1
      context.beginPath()
      context.arc(portX, portY, 5, 0, Math.PI * 2)
      context.fill()
      context.stroke()
    }

    const select = (event) => {
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

      selectedSubCode = selected?.subCode
      input.value = selectedSubCode || ''
      input.disabled = !selected
      status.textContent = selected ? `${selected.subCode} selected` : 'No statistical area selected'
      render()
      if (selected) form.requestSubmit()
    }

    // Tracks every touch point currently down, keyed by pointerId, so a second finger switches
    // seamlessly from single-finger pan to two-finger pinch-zoom (and back again on lift) - mouse
    // interaction only ever has one pointer, so it always takes the single-finger pan path.
    const activePointers = new Map()
    const pointFor = (event) => ({ x: event.clientX, y: event.clientY })
    const pointDistance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y)
    const midpoint = (first, second) => [(first.x + second.x) / 2, (first.y + second.y) / 2]

    let activeDragId
    let dragOrigin
    let dragStart
    let hadMultiTouch = false
    let pinchStartDistance
    let pinchStartViewport
    let pinchAnchor

    canvas.addEventListener('pointerdown', (event) => {
      try {
        canvas.setPointerCapture(event.pointerId)
      } catch {
        // Some browsers reject capture for a pointer that's already gone - safe to ignore.
      }
      activePointers.set(event.pointerId, pointFor(event))

      if (activePointers.size === 1) {
        hadMultiTouch = false
        activeDragId = event.pointerId
        dragOrigin = [event.clientX, event.clientY]
        dragStart = dragOrigin
      } else if (activePointers.size === 2) {
        hadMultiTouch = true
        activeDragId = undefined
        const [first, second] = [...activePointers.values()]
        pinchStartDistance = pointDistance(first, second)
        pinchStartViewport = { ...viewport }
        pinchAnchor = clientPointToMap(...midpoint(first, second))
      }
    })
    canvas.addEventListener('pointermove', (event) => {
      if (!activePointers.has(event.pointerId) || event.buttons === 0) return
      activePointers.set(event.pointerId, pointFor(event))

      if (activePointers.size === 2 && pinchStartDistance) {
        const [first, second] = [...activePointers.values()]
        const distance = pointDistance(first, second)
        if (distance === 0) return
        viewport = zoomViewport(pinchStartViewport, pinchStartDistance / distance, pinchAnchor, minSpan, maxSpan, maximumZoomOutExtent)
        render()
        return
      }

      if (event.pointerId !== activeDragId || !dragStart) return
      const longitudeOffset = ((event.clientX - dragStart[0]) * (viewport.maxLongitude - viewport.minLongitude)) / canvas.width
      const latitudeOffset = ((event.clientY - dragStart[1]) * (viewport.maxLatitude - viewport.minLatitude)) / canvas.height
      viewport = clampViewport({
        minLongitude: viewport.minLongitude - longitudeOffset,
        maxLongitude: viewport.maxLongitude - longitudeOffset,
        minLatitude: viewport.minLatitude + latitudeOffset,
        maxLatitude: viewport.maxLatitude + latitudeOffset
      }, maximumZoomOutExtent)
      dragStart = [event.clientX, event.clientY]
      render()
    })
    const endPointer = (event) => {
      activePointers.delete(event.pointerId)
      pinchStartDistance = undefined

      if (activePointers.size === 1) {
        const [remainingId] = [...activePointers.keys()]
        const remaining = activePointers.get(remainingId)
        activeDragId = remainingId
        dragStart = [remaining.x, remaining.y]
        return
      }

      if (activePointers.size === 0 && event.pointerId === activeDragId) {
        const wasDrag = dragOrigin && Math.hypot(event.clientX - dragOrigin[0], event.clientY - dragOrigin[1]) > 5
        activeDragId = undefined
        dragStart = undefined
        if (!wasDrag && !hadMultiTouch) select(event)
      }
    }
    canvas.addEventListener('pointerup', endPointer)
    canvas.addEventListener('pointercancel', endPointer)
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault()
      const anchor = clientPointToMap(event.clientX, event.clientY)
      const scale = event.deltaY > 0 ? zoomStep : 1 / zoomStep
      viewport = zoomViewport(viewport, scale, anchor, minSpan, maxSpan, maximumZoomOutExtent)
      render()
    }, { passive: false })

    render()
  } catch {
    map.hidden = true
  }
}