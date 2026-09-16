import { closestSubrectangles } from './statistical-area-map-geometry.js'
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
  attachPointerHandlers
} from './statistical-area-map-gestures.js'

export { closestSubrectangles }

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
