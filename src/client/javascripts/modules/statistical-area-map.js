import {
  resizeCanvas,
  loadOfflineMapData,
  findDeparturePort,
  findDepartureCell,
  computeZoomExtents,
  createRender
} from './statistical-area-map-render.js'
import {
  createClientPointToMap,
  createSelect,
  attachPointerHandlers,
  attachZoomButtonHandlers
} from './statistical-area-map-gestures.js'

export { closestSubrectangles } from './statistical-area-map-geometry.js'

function setMapLoadError(canvas, errorElement, hasError) {
  canvas.hidden = hasError
  if (errorElement) {
    errorElement.hidden = !hasError
  }
}

async function setUpMap(
  map,
  canvas,
  input,
  status,
  form,
  zoomInButton,
  zoomOutButton
) {
  const mapData = await loadOfflineMapData()
  if (!mapData) {
    return false
  }
  const { land, subrectangles, ports } = mapData

  const departurePort = findDeparturePort(ports, map)
  if (!departurePort) {
    return false
  }

  resizeCanvas(canvas)
  const departureCell = findDepartureCell(subrectangles, departurePort)
  if (!departureCell) {
    return false
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
  attachZoomButtonHandlers({
    zoomInButton,
    zoomOutButton,
    state,
    extents,
    render
  })

  render()
  return true
}

export async function initialiseStatisticalAreaMap() {
  const map = document.querySelector('[data-statistical-area-map]')
  if (!map) {
    return
  }

  const canvas = map.querySelector('canvas')
  const input = map.querySelector('[data-statistical-area-map-input]')
  const status = map.querySelector('[data-statistical-area-map-status]')
  const errorElement = map.querySelector('[data-statistical-area-map-error]')
  const retryButton = map.querySelector('[data-statistical-area-map-retry]')
  const zoomInButton = map.querySelector('[data-statistical-area-map-zoom-in]')
  const zoomOutButton = map.querySelector(
    '[data-statistical-area-map-zoom-out]'
  )
  const form = map.closest('form')

  async function attemptLoad() {
    setMapLoadError(canvas, errorElement, false)
    try {
      const loaded = await setUpMap(
        map,
        canvas,
        input,
        status,
        form,
        zoomInButton,
        zoomOutButton
      )
      setMapLoadError(canvas, errorElement, !loaded)
    } catch {
      setMapLoadError(canvas, errorElement, true)
    }
  }

  retryButton?.addEventListener('click', attemptLoad)

  await attemptLoad()
}
