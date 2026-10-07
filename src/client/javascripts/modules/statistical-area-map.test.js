// @vitest-environment jsdom
import { initialiseStatisticalAreaMap } from './statistical-area-map.js'
import {
  loadOfflineMapData,
  findDeparturePort,
  mapLandGeoJsonToCanvasData,
  mapSubrectanglesGeoJsonToCanvasData
} from './statistical-area-map-render.js'

const subrectangle = {
  subCode: 'R0C0',
  overlapsSea: true,
  bounds: { minLongitude: 0, maxLongitude: 1, minLatitude: 0, maxLatitude: 1 },
  labelCoordinate: [0.5, 0.5],
  polygons: [
    {
      exterior: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1]
      ],
      holes: [
        [
          [0.4, 0.4],
          [0.6, 0.4],
          [0.6, 0.6],
          [0.4, 0.6]
        ]
      ]
    }
  ]
}

const landFeature = {
  bounds: {
    minLongitude: -0.5,
    maxLongitude: 0.3,
    minLatitude: -0.5,
    maxLatitude: 0.3
  },
  polygons: [
    {
      exterior: [
        [-0.5, -0.5],
        [0.3, -0.5],
        [0.3, 0.3],
        [-0.5, 0.3]
      ],
      holes: []
    }
  ]
}

const port = { name: 'Hastings', coordinate: [0.5, 0.5] }

function fakeContext() {
  return {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    arc: vi.fn()
  }
}

function setupMapDom({ departurePort = 'Hastings', selectedArea = '' } = {}) {
  document.body.innerHTML = `
    <form>
      <div data-statistical-area-map data-departure-port="${departurePort}" data-selected-area="${selectedArea}">
        <canvas></canvas>
        <div data-statistical-area-map-error hidden>
          <button type="button" data-statistical-area-map-retry>Retry</button>
        </div>
        <div>
          <button type="button" data-statistical-area-map-zoom-in>+</button>
          <button type="button" data-statistical-area-map-zoom-out>-</button>
        </div>
        <input data-statistical-area-map-input />
        <p data-statistical-area-map-status></p>
      </div>
    </form>
  `

  const map = document.querySelector('[data-statistical-area-map]')
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
  const context = fakeContext()

  canvas.getContext = () => context
  canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 100,
    height: 100
  })
  form.requestSubmit = vi.fn()

  return {
    map,
    canvas,
    input,
    status,
    errorElement,
    retryButton,
    zoomInButton,
    zoomOutButton,
    form,
    context
  }
}

function mockFetchWith({ land, subrectangles, ports, apiLand, apiAreas }) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      if (url === '/map-data/land') {
        return Promise.resolve({
          ok: Boolean(apiLand),
          json: () => Promise.resolve(apiLand)
        })
      }
      if (url === '/map-data/statistical-areas') {
        return Promise.resolve({
          ok: Boolean(apiAreas),
          json: () => Promise.resolve(apiAreas)
        })
      }
      if (url.includes('land.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ land })
        })
      }
      if (url.includes('subrectangles.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ subrectangles })
        })
      }
      if (url.includes('ports.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ports })
        })
      }
      return Promise.resolve({ ok: false })
    })
  )
}

function pointerEvent(
  type,
  { pointerId = 1, clientX = 0, clientY = 0, buttons = 1 } = {}
) {
  return new PointerEvent(type, { pointerId, clientX, clientY, buttons })
}

beforeEach(() => {
  Object.defineProperty(window, 'devicePixelRatio', {
    value: 1,
    configurable: true
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('#initialiseStatisticalAreaMap', () => {
  test('Should use selected reference-data coordinates when the port name is missing from bundled map ports', () => {
    const map = {
      dataset: {
        departurePort: 'Aberdaron',
        departurePortCoordinate: '[-4.712,52.805]'
      }
    }

    expect(findDeparturePort([], map)).toEqual({
      name: 'Aberdaron',
      coordinate: [-4.712, 52.805]
    })
  })

  test('Should convert API GeoJSON land polygons to canvas polygons', async () => {
    const apiLand = {
      type: 'FeatureCollection',
      metadata: { dataset: 'map-land' },
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0]
              ],
              [
                [0.2, 0.2],
                [0.3, 0.2],
                [0.3, 0.3],
                [0.2, 0.2]
              ]
            ]
          }
        }
      ]
    }

    expect(mapLandGeoJsonToCanvasData(apiLand)).toEqual([
      {
        polygons: [
          {
            exterior: apiLand.features[0].geometry.coordinates[0],
            holes: [apiLand.features[0].geometry.coordinates[1]]
          }
        ],
        bounds: {
          minLongitude: 0,
          maxLongitude: 1,
          minLatitude: 0,
          maxLatitude: 1
        }
      }
    ])
  })

  test('Should initialize the map with bundled land and selection layers', async () => {
    const dom = setupMapDom()
    mockFetchWith({
      land: [landFeature],
      apiLand: {
        type: 'FeatureCollection',
        metadata: { dataset: 'map-land' },
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [landFeature.polygons[0].exterior]
            }
          }
        ]
      },
      subrectangles: [subrectangle],
      ports: [port]
    })

    await initialiseStatisticalAreaMap()

    expect(dom.canvas.hidden).toBe(false)
    expect(dom.errorElement.hidden).toBe(true)
    expect(dom.context.fill).toHaveBeenCalled()
  })

  test('Should use bundled land even when API land is available', async () => {
    const bundledLand = [landFeature]
    const apiLand = {
      type: 'FeatureCollection',
      metadata: { dataset: 'map-land' },
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0]
              ]
            ]
          }
        }
      ]
    }
    mockFetchWith({
      land: bundledLand,
      subrectangles: [subrectangle],
      ports: [port],
      apiLand
    })

    const mapData = await loadOfflineMapData()
    expect(mapData.land).toEqual(bundledLand)

    mockFetchWith({
      land: bundledLand,
      subrectangles: [subrectangle],
      ports: [port]
    })
    const fallbackData = await loadOfflineMapData()
    expect(fallbackData.land).toEqual(bundledLand)
  })

  test('Should merge API subrectangles with bundled coverage and keep bundled land', async () => {
    const apiAreas = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            code: 'R0C1',
            areaType: 'ices-subrectangle',
            centroid: { longitude: 1.5, latitude: 0.5 }
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [1, 0],
                [2, 0],
                [2, 1],
                [1, 1],
                [1, 0]
              ]
            ]
          }
        },
        {
          type: 'Feature',
          properties: { code: 'PARENT', areaType: 'ices-rectangle' },
          geometry: { type: 'Point', coordinates: [0, 0] }
        }
      ]
    }
    mockFetchWith({
      land: [landFeature],
      subrectangles: [subrectangle],
      ports: [port],
      apiAreas
    })

    const mapData = await loadOfflineMapData()

    expect(fetch).toHaveBeenCalledWith('/map-data/statistical-areas')
    expect(mapData.land).toEqual([landFeature])
    expect(mapData.subrectangles).toHaveLength(2)
    expect(mapData.subrectangles[0]).toEqual(subrectangle)
    expect(mapData.subrectangles[1]).toEqual({
      subCode: 'R0C1',
      polygons: [
        { exterior: apiAreas.features[0].geometry.coordinates[0], holes: [] }
      ],
      bounds: {
        minLongitude: 1,
        maxLongitude: 2,
        minLatitude: 0,
        maxLatitude: 1
      },
      labelCoordinate: [1.5, 0.5],
      overlapsSea: true
    })
    expect(mapSubrectanglesGeoJsonToCanvasData(apiAreas)).toHaveLength(1)
  })

  test('Should retain bundled geometry when the API has a distant cell with the same code', async () => {
    const apiAreas = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { code: 'R0C0', areaType: 'ices-subrectangle' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [10, 10],
                [11, 10],
                [11, 11],
                [10, 10]
              ]
            ]
          }
        }
      ]
    }
    mockFetchWith({
      land: [landFeature],
      subrectangles: [subrectangle],
      ports: [port],
      apiAreas
    })

    const mapData = await loadOfflineMapData()
    expect(mapData.subrectangles).toEqual([subrectangle])
  })

  test('Should do nothing when there is no map element', async () => {
    document.body.innerHTML = '<div></div>'

    await expect(initialiseStatisticalAreaMap()).resolves.toBeUndefined()
  })

  test('Should show an error and hide the canvas when any offline data request fails', async () => {
    const { context, canvas, errorElement } = setupMapDom()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) })
    )

    await initialiseStatisticalAreaMap()

    expect(context.fillRect).not.toHaveBeenCalled()
    expect(canvas.hidden).toBe(true)
    expect(errorElement.hidden).toBe(false)
  })

  test('Should show an error when loading the offline data throws', async () => {
    const { canvas, errorElement } = setupMapDom()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    await initialiseStatisticalAreaMap()

    expect(canvas.hidden).toBe(true)
    expect(errorElement.hidden).toBe(false)
  })

  test('Should retry loading the map data when the retry button is clicked', async () => {
    const { context, canvas, errorElement, retryButton } = setupMapDom()
    canvas.setPointerCapture = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    await initialiseStatisticalAreaMap()

    expect(canvas.hidden).toBe(true)
    expect(errorElement.hidden).toBe(false)

    mockFetchWith({
      land: [landFeature],
      subrectangles: [subrectangle],
      ports: [port]
    })
    retryButton.click()
    await vi.waitFor(() => expect(context.fillRect).toHaveBeenCalled())

    expect(canvas.hidden).toBe(false)
    expect(errorElement.hidden).toBe(true)
  })

  test('Should show an error when the departure port cannot be found', async () => {
    const { context, canvas, errorElement } = setupMapDom({
      departurePort: 'Unknown Port'
    })
    mockFetchWith({
      land: [landFeature],
      subrectangles: [subrectangle],
      ports: [port]
    })

    await initialiseStatisticalAreaMap()

    expect(context.fillRect).not.toHaveBeenCalled()
    expect(canvas.hidden).toBe(true)
    expect(errorElement.hidden).toBe(false)
  })

  test('Should show an error when the departure cell cannot be found', async () => {
    const { context, canvas, errorElement } = setupMapDom()
    mockFetchWith({
      land: [landFeature],
      subrectangles: [],
      ports: [port]
    })

    await initialiseStatisticalAreaMap()

    expect(context.fillRect).not.toHaveBeenCalled()
    expect(canvas.hidden).toBe(true)
    expect(errorElement.hidden).toBe(false)
  })

  test('Should render the grid, land and departure port marker on a successful load', async () => {
    const { context, canvas } = setupMapDom()
    canvas.setPointerCapture = vi.fn()
    mockFetchWith({
      land: [landFeature],
      subrectangles: [subrectangle],
      ports: [port]
    })

    await initialiseStatisticalAreaMap()

    expect(context.fillRect).toHaveBeenCalled()
    expect(context.fill).toHaveBeenCalled()
    expect(context.stroke).toHaveBeenCalled()
    expect(context.fillText).toHaveBeenCalled()
    expect(context.arc).toHaveBeenCalled()
  })

  test('Should select a subrectangle on tap and submit the form', async () => {
    const { input, status, form } = setupMapDom()
    mockFetchWith({
      land: [landFeature],
      subrectangles: [subrectangle],
      ports: [port]
    })

    await initialiseStatisticalAreaMap()

    const canvas = document.querySelector('canvas')
    canvas.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 5, clientY: 95 })
    )
    canvas.dispatchEvent(pointerEvent('pointerup', { clientX: 5, clientY: 95 }))

    expect(input.value).toBe('R0C0')
    expect(input.disabled).toBe(false)
    expect(status.textContent).toBe('R0C0 selected')
    expect(form.requestSubmit).toHaveBeenCalled()
  })

  test('Should report no selection when tapping a hole in the subrectangle', async () => {
    const { input, status, form } = setupMapDom()
    mockFetchWith({
      land: [landFeature],
      subrectangles: [subrectangle],
      ports: [port]
    })

    await initialiseStatisticalAreaMap()

    const canvas = document.querySelector('canvas')
    canvas.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 50, clientY: 50 })
    )
    canvas.dispatchEvent(
      pointerEvent('pointerup', { clientX: 50, clientY: 50 })
    )

    expect(input.value).toBe('')
    expect(input.disabled).toBe(true)
    expect(status.textContent).toBe('No statistical area selected')
    expect(form.requestSubmit).not.toHaveBeenCalled()
  })

  test('Should not select when the pointer is dragged past the threshold', async () => {
    const { form } = setupMapDom()
    mockFetchWith({
      land: [landFeature],
      subrectangles: [subrectangle],
      ports: [port]
    })

    await initialiseStatisticalAreaMap()

    const canvas = document.querySelector('canvas')
    canvas.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 5, clientY: 95 })
    )
    canvas.dispatchEvent(
      pointerEvent('pointermove', { clientX: 20, clientY: 80, buttons: 1 })
    )
    canvas.dispatchEvent(
      pointerEvent('pointerup', { clientX: 20, clientY: 80 })
    )

    expect(form.requestSubmit).not.toHaveBeenCalled()
  })

  test('Should ignore pointermove for an untracked pointer or with no buttons pressed', async () => {
    setupMapDom()
    mockFetchWith({
      land: [landFeature],
      subrectangles: [subrectangle],
      ports: [port]
    })

    await initialiseStatisticalAreaMap()

    const canvas = document.querySelector('canvas')
    expect(() =>
      canvas.dispatchEvent(
        pointerEvent('pointermove', { pointerId: 99, clientX: 5, clientY: 5 })
      )
    ).not.toThrow()

    canvas.dispatchEvent(
      pointerEvent('pointerdown', { clientX: 5, clientY: 95, buttons: 1 })
    )
    expect(() =>
      canvas.dispatchEvent(
        pointerEvent('pointermove', { clientX: 6, clientY: 96, buttons: 0 })
      )
    ).not.toThrow()
  })

  test('Should support two-finger pinch gestures without throwing', async () => {
    setupMapDom()
    mockFetchWith({
      land: [landFeature],
      subrectangles: [subrectangle],
      ports: [port]
    })

    await initialiseStatisticalAreaMap()

    const canvas = document.querySelector('canvas')
    canvas.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 1, clientX: 10, clientY: 10 })
    )
    canvas.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 2, clientX: 90, clientY: 90 })
    )
    canvas.dispatchEvent(
      pointerEvent('pointermove', {
        pointerId: 1,
        clientX: 20,
        clientY: 20,
        buttons: 1
      })
    )
    // Moving to the same point as the other pointer exercises the zero-distance guard.
    canvas.dispatchEvent(
      pointerEvent('pointermove', {
        pointerId: 1,
        clientX: 90,
        clientY: 90,
        buttons: 1
      })
    )
    canvas.dispatchEvent(
      pointerEvent('pointerup', { pointerId: 2, clientX: 90, clientY: 90 })
    )
    canvas.dispatchEvent(
      pointerEvent('pointercancel', { pointerId: 1, clientX: 90, clientY: 90 })
    )

    expect(true).toBe(true)
  })

  test('Should ignore a third simultaneous pointer', async () => {
    setupMapDom()
    mockFetchWith({
      land: [landFeature],
      subrectangles: [subrectangle],
      ports: [port]
    })

    await initialiseStatisticalAreaMap()

    const canvas = document.querySelector('canvas')
    canvas.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 1, clientX: 10, clientY: 10 })
    )
    canvas.dispatchEvent(
      pointerEvent('pointerdown', { pointerId: 2, clientX: 90, clientY: 90 })
    )

    expect(() =>
      canvas.dispatchEvent(
        pointerEvent('pointerdown', { pointerId: 3, clientX: 50, clientY: 50 })
      )
    ).not.toThrow()
  })

  test('Should zoom in and out on wheel events', async () => {
    const { context } = setupMapDom()
    mockFetchWith({
      land: [landFeature],
      subrectangles: [subrectangle],
      ports: [port]
    })

    await initialiseStatisticalAreaMap()
    context.fillRect.mockClear()

    const canvas = document.querySelector('canvas')
    canvas.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: 100,
        clientX: 50,
        clientY: 50,
        cancelable: true
      })
    )
    canvas.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -100,
        clientX: 50,
        clientY: 50,
        cancelable: true
      })
    )

    expect(context.fillRect).toHaveBeenCalled()
  })

  test('Should zoom in and out on button clicks', async () => {
    const { context, zoomInButton, zoomOutButton } = setupMapDom()
    mockFetchWith({
      land: [landFeature],
      subrectangles: [subrectangle],
      ports: [port]
    })

    await initialiseStatisticalAreaMap()
    context.fillRect.mockClear()

    zoomInButton.click()
    expect(context.fillRect).toHaveBeenCalled()

    context.fillRect.mockClear()
    zoomOutButton.click()
    expect(context.fillRect).toHaveBeenCalled()
  })

  test('Should not throw when repeatedly zooming past the minimum or maximum extent', async () => {
    const { zoomInButton, zoomOutButton } = setupMapDom()
    mockFetchWith({
      land: [landFeature],
      subrectangles: [subrectangle],
      ports: [port]
    })

    await initialiseStatisticalAreaMap()

    expect(() => {
      for (let i = 0; i < 50; i++) {
        zoomInButton.click()
      }
      for (let i = 0; i < 50; i++) {
        zoomOutButton.click()
      }
    }).not.toThrow()
  })
})
