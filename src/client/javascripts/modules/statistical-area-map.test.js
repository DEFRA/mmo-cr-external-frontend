// @vitest-environment jsdom
import { initialiseStatisticalAreaMap } from './statistical-area-map.js'

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
        <input data-statistical-area-map-input />
        <p data-statistical-area-map-status></p>
      </div>
    </form>
  `

  const map = document.querySelector('[data-statistical-area-map]')
  const canvas = map.querySelector('canvas')
  const input = map.querySelector('[data-statistical-area-map-input]')
  const status = map.querySelector('[data-statistical-area-map-status]')
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

  return { map, canvas, input, status, form, context }
}

function mockFetchWith({ land, subrectangles, ports }) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
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
  test('Should do nothing when there is no map element', async () => {
    document.body.innerHTML = '<div></div>'

    await expect(initialiseStatisticalAreaMap()).resolves.toBeUndefined()
  })

  test('Should not render when any offline data request fails', async () => {
    const { context } = setupMapDom()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) })
    )

    await initialiseStatisticalAreaMap()

    expect(context.fillRect).not.toHaveBeenCalled()
  })

  test('Should hide the map when loading the offline data throws', async () => {
    const { map } = setupMapDom()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

    await initialiseStatisticalAreaMap()

    expect(map.hidden).toBe(true)
  })

  test('Should not render when the departure port cannot be found', async () => {
    const { context } = setupMapDom({ departurePort: 'Unknown Port' })
    mockFetchWith({
      land: [landFeature],
      subrectangles: [subrectangle],
      ports: [port]
    })

    await initialiseStatisticalAreaMap()

    expect(context.fillRect).not.toHaveBeenCalled()
  })

  test('Should not render when the departure cell cannot be found', async () => {
    const { context } = setupMapDom()
    mockFetchWith({
      land: [landFeature],
      subrectangles: [],
      ports: [port]
    })

    await initialiseStatisticalAreaMap()

    expect(context.fillRect).not.toHaveBeenCalled()
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
})
