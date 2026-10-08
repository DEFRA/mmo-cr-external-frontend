import { createGearsReferenceDataClient } from './gears-reference-data.js'

const measurement = {
  id: 'measurement-id',
  code: 'MESH_SIZE',
  label: 'Mesh size',
  kind: 'number',
  unit: 'mm',
  minimumValue: 20,
  maximumValue: 300
}
const gearOne = {
  id: 'gear-one',
  code: 'OTB',
  name: 'Otter trawl',
  category: { id: 'category-id', code: 'TOWED', name: 'Towed gear' },
  pairFishing: false,
  requiredMeasurementIds: [],
  variableMeasurementIds: ['measurement-id']
}
const gearTwo = {
  ...gearOne,
  id: 'gear-two',
  code: 'PTB',
  name: 'Pair trawl',
  requiredMeasurementIds: ['measurement-id'],
  variableMeasurementIds: []
}

function page(
  items,
  { total = items.length, offset = 0, etag = '"gears-v1"' } = {}
) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => etag },
    json: async () => ({
      items,
      measurements: items.length ? [measurement] : [],
      total,
      offset,
      limit: 1,
      version: 'v1',
      context: { vesselLengthBand: 'under-10m' }
    })
  }
}

describe('#createGearsReferenceDataClient', () => {
  test('Should combine pages, measurements and per-page ETags', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(page([gearOne], { total: 2, etag: '"first"' }))
      .mockResolvedValueOnce(
        page([gearTwo], { total: 2, offset: 1, etag: '"second"' })
      )
      .mockResolvedValueOnce({ status: 304 })
      .mockResolvedValueOnce({ status: 304 })
    const client = createGearsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    const first = await client.getGears()
    const second = await client.getGears()

    expect(first.items).toHaveLength(2)
    expect(first.items[0].measurements[0]).toMatchObject({
      id: 'measurement-id',
      label: 'Mesh size',
      required: false
    })
    expect(first.items[1].measurements[0].required).toBe(true)
    expect(first.context.vesselLengthBand).toBe('under-10m')
    expect(second.items).toEqual(first.items)
    expect(fetchFn.mock.calls[0][0]).toContain(
      '/gears?view=mobile&offset=0&limit=500'
    )
    expect(fetchFn.mock.calls[1][0]).toContain('offset=1')
    expect(fetchFn.mock.calls[2][1].headers['If-None-Match']).toBe('"first"')
    expect(fetchFn.mock.calls[3][1].headers['If-None-Match']).toBe('"second"')
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer test-token'
    )
  })

  test('Should pass documented filters and preserve canonical collection records', async () => {
    const canonicalGear = {
      ...gearOne,
      categoryId: 'category-id',
      type: 'trawl'
    }
    const fetchFn = vi.fn().mockResolvedValue(page([canonicalGear]))
    const client = createGearsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    const result = await client.getGears({
      view: 'canonical',
      query: 'otter',
      code: 'OTB',
      pairFishing: false
    })

    expect(result.items[0]).toMatchObject({
      categoryId: 'category-id',
      type: 'trawl'
    })
    expect(fetchFn.mock.calls[0][0]).toContain(
      'view=canonical&query=otter&code=OTB&pairFishing=false'
    )
  })

  test('Should accept canonical pages without the mobile measurements projection', async () => {
    const canonicalGear = {
      id: gearOne.id,
      code: gearOne.code,
      name: gearOne.name,
      type: 'trawl',
      categoryId: 'category-id',
      applicableCharacteristics: []
    }
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => '"canonical-v1"' },
      json: async () => ({
        items: [canonicalGear],
        total: 1,
        offset: 0,
        limit: 500,
        version: 'v1'
      })
    })
    const client = createGearsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    expect((await client.getGears({ view: 'canonical' })).items).toEqual([
      canonicalGear
    ])
  })

  test('Should include vessel length context in query', async () => {
    const fetchFn = vi.fn().mockResolvedValue(page([gearOne]))
    const client = createGearsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    await client.getGears({ vesselLengthMetres: 8.5 })
    expect(fetchFn.mock.calls[0][0]).toContain('vesselLengthMetres=8.5')
  })

  test('Should read an item by GUID and propagate 404', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => gearOne })
      .mockResolvedValueOnce({ ok: false, status: 404 })
    const client = createGearsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    expect((await client.getGear('gear-one')).name).toBe('Otter trawl')
    expect(fetchFn.mock.calls[0][0]).toContain('/gears/gear-one?view=mobile')
    await expect(client.getGear('unknown')).rejects.toMatchObject({
      statusCode: 404
    })
  })

  test('Should revalidate a cached item and reuse it on 304', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => '"gear-item-v1"' },
        json: async () => gearOne
      })
      .mockResolvedValueOnce({ status: 304 })
    const client = createGearsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    const first = await client.getGear('gear-one')
    const second = await client.getGear('gear-one')
    expect(second).toBe(first)
    expect(fetchFn.mock.calls[1][1].headers['If-None-Match']).toBe(
      '"gear-item-v1"'
    )
  })

  test('Should fail closed when the token is missing', async () => {
    const fetchFn = vi.fn()
    const client = createGearsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      fetchFn
    })

    await expect(client.getGears()).rejects.toThrow('not configured')
    await expect(client.getGear('gear-one')).rejects.toThrow('not configured')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  test('Should use the last complete collection after a server error', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(page([gearOne]))
      .mockResolvedValueOnce({ ok: false, status: 503 })
    const client = createGearsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    const cached = await client.getGears()
    await expect(client.getGears()).resolves.toBe(cached)
  })

  test('Should reject a page whose metadata does not match the requested offset', async () => {
    const invalidPage = page([gearOne])
    invalidPage.json = async () => ({
      items: [gearOne],
      measurements: [measurement],
      total: 1,
      offset: 1,
      limit: 1,
      version: 'v1'
    })
    const client = createGearsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn: vi.fn().mockResolvedValue(invalidPage)
    })

    await expect(client.getGears()).rejects.toMatchObject({
      message: 'Gears reference data returned an invalid response'
    })
  })

  test('Should reject an invalid gear item response', async () => {
    const client = createGearsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn: vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => null },
        json: async () => ({ id: 'gear-one' })
      })
    })

    await expect(client.getGear('gear-one')).rejects.toMatchObject({
      message: 'Gears reference data returned an invalid response'
    })
  })

  test('Should return a cached item after a server error', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => '"gear-v1"' },
        json: async () => gearOne
      })
      .mockResolvedValueOnce({ ok: false, status: 500 })
    const client = createGearsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    const cached = await client.getGear('gear-one')
    await expect(client.getGear('gear-one')).resolves.toBe(cached)
  })
})
