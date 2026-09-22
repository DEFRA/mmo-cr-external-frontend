import {
  dragThresholdPixels,
  zoomStep
} from './statistical-area-map-constants.js'
import {
  boundsIntersect,
  containsPoint,
  clampViewport,
  zoomViewport,
  toCoordinate
} from './statistical-area-map-geometry.js'

export function createClientPointToMap(canvas, state) {
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

// Buttons zoom around the current viewport centre, unlike wheel/pinch which zoom around the pointer.
function zoomByStep(scale, state, extents, render) {
  const anchor = [
    (state.viewport.minLongitude + state.viewport.maxLongitude) / 2,
    (state.viewport.minLatitude + state.viewport.maxLatitude) / 2
  ]
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

export function attachZoomButtonHandlers({
  zoomInButton,
  zoomOutButton,
  state,
  extents,
  render
}) {
  zoomInButton?.addEventListener('click', () =>
    zoomByStep(1 / zoomStep, state, extents, render)
  )
  zoomOutButton?.addEventListener('click', () =>
    zoomByStep(zoomStep, state, extents, render)
  )
}

export function createSelect({
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

    state.selectedSubCode = selected?.subCode || null
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
    dragState.activeDragId = null
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
  dragState.pinchStartDistance = null

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
    dragState.activeDragId = null
    dragState.dragStart = null
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

export function attachPointerHandlers({
  canvas,
  state,
  extents,
  clientPointToMap,
  render,
  select
}) {
  const dragState = {
    activePointers: new Map(),
    activeDragId: null,
    dragOrigin: null,
    dragStart: null,
    hadMultiTouch: false,
    pinchStartDistance: null,
    pinchStartViewport: null,
    pinchAnchor: null
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
