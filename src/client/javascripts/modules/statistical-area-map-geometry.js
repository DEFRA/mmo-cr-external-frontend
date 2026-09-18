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
export function viewportForCellGrid(
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

export function clampViewport(viewport, extent) {
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

export function spanOf(viewport) {
  return {
    longitude: viewport.maxLongitude - viewport.minLongitude,
    latitude: viewport.maxLatitude - viewport.minLatitude
  }
}

// Continuous, hard-clamped zoom around a map coordinate: the span can never shrink past
// `minSpan` (most zoomed in) or grow past `maxSpan` (most zoomed out), mirroring MapKit's
// `CameraZoomRange` enforcement rather than snapping between fixed steps.
export function zoomViewport(
  viewport,
  scale,
  anchor,
  minSpan,
  maxSpan,
  panExtent
) {
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

export function toScreen([longitude, latitude], viewport, canvas) {
  return [
    ((longitude - viewport.minLongitude) /
      (viewport.maxLongitude - viewport.minLongitude)) *
      canvas.width,
    ((viewport.maxLatitude - latitude) /
      (viewport.maxLatitude - viewport.minLatitude)) *
      canvas.height
  ]
}

export function toCoordinate([x, y], viewport, canvas) {
  return [
    viewport.minLongitude +
      (x / canvas.width) * (viewport.maxLongitude - viewport.minLongitude),
    viewport.maxLatitude -
      (y / canvas.height) * (viewport.maxLatitude - viewport.minLatitude)
  ]
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

export { boundsIntersect, intersectBounds, clampPointToBounds, containsPoint }
