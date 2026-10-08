import { createVesselsReferenceDataClient } from './vessels-reference-data.js'

const firstVessel = {
  id: '00000000-0000-4000-8000-000000000011',
  name: 'ACHILLES',
  pln: 'PH1234',
  cfr: 'GBR000A1234',
  displayName: 'ACHILLES PH1234'
}
const secondVessel = {
  id: '00000000-0000-4000-8000-000000000012',
  name: 'SEA SPRAY',
  pln: 'BM45',
  cfr: 'GBR000B5678',
  displayName: 'SEA SPRAY BM45'
}

function page(
  items,
  { total = items.length, offset = 0, etag = '"vessels-v1"' } = {}
) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => etag },
    json: async () => ({ items, total, offset, limit: 50, version: 'v1' })
  }
}

describe('#createVesselsReferenceDataClient', () => {
  test('Should combine pages and revalidate each using its own ETag', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(page([firstVessel], { total: 2, etag: '"first"' }))
      .mockResolvedValueOnce(
        page([secondVessel], { total: 2, offset: 1, etag: '"second"' })
      )
      .mockResolvedValueOnce({ status: 304 })
      .mockResolvedValueOnce({ status: 304 })
    const client = createVesselsReferenceDataClient({
      serviceUrl: 'http://localhost:3002/',
      token: 'test-token',
      fetchFn
    })

    const first = await client.getVessels()
    const second = await client.getVessels()

    expect(first.map((vessel) => vessel.id)).toEqual([
      firstVessel.id,
      secondVessel.id
    ])
    expect(second).toEqual(first)
    expect(fetchFn.mock.calls[0][0]).toContain('/vessels?view=mobile&offset=0')
    expect(fetchFn.mock.calls[1][0]).toContain('&offset=1')
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer test-token'
    )
    expect(fetchFn.mock.calls[2][1].headers['If-None-Match']).toBe('"first"')
    expect(fetchFn.mock.calls[3][1].headers['If-None-Match']).toBe('"second"')
  })

  test('Should pass documented filters and preserve full canonical fields', async () => {
    const canonical = {
      id: firstVessel.id,
      name: 'ACHILLES',
      namePln: 'ACHILLES PH1234',
      identifiers: { cfr: firstVessel.cfr },
      status: 'active'
    }
    const fetchFn = vi.fn().mockResolvedValue(page([canonical]))
    const client = createVesselsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    expect(
      await client.getVessels({
        view: 'canonical',
        query: 'ACHILLES',
        cfr: firstVessel.cfr
      })
    ).toEqual([canonical])
    expect(fetchFn.mock.calls[0][0]).toContain(
      'view=canonical&query=ACHILLES&cfr=GBR000A1234&offset=0'
    )
  })

  test('Should accept vessels with no PLN or CFR', async () => {
    const vessel = {
      ...firstVessel,
      pln: null,
      cfr: null,
      displayName: 'ACHILLES'
    }
    const client = createVesselsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn: vi.fn().mockResolvedValue(page([vessel]))
    })

    expect(await client.getVessels()).toEqual([vessel])
  })

  test('Should read a vessel by GUID and propagate item 404', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => firstVessel })
      .mockResolvedValueOnce({ ok: false, status: 404 })
    const client = createVesselsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    expect((await client.getVessel(firstVessel.id)).name).toBe('ACHILLES')
    expect(fetchFn.mock.calls[0][0]).toContain(
      `/vessels/${firstVessel.id}?view=mobile`
    )
    await expect(client.getVessel('unknown')).rejects.toMatchObject({
      statusCode: 404
    })
  })

  test('Should retain the last complete catalogue on a later-page network failure', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(page([firstVessel]))
      .mockResolvedValueOnce(page([firstVessel], { total: 2 }))
      .mockRejectedValueOnce(new Error('network failure'))
    const client = createVesselsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    const first = await client.getVessels()
    expect(await client.getVessels()).toBe(first)
  })

  test('Should not fetch or use cached results when credentials are missing', async () => {
    let token = 'test-token'
    const fetchFn = vi.fn().mockResolvedValue(page([firstVessel]))
    const client = createVesselsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: () => token,
      fetchFn
    })

    await client.getVessels()
    token = undefined

    await expect(client.getVessels()).rejects.toThrow('not configured')
    await expect(client.getVessel(firstVessel.id)).rejects.toThrow(
      'not configured'
    )
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  test('Should reject malformed mobile vessel items', async () => {
    const client = createVesselsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn: vi
        .fn()
        .mockResolvedValue(
          page([{ id: 'vessel-id', name: 'Missing identifiers' }])
        )
    })

    await expect(client.getVessels()).rejects.toMatchObject({
      message: 'Vessels reference data returned an invalid response'
    })
  })

  test('Should reject an invalid item and propagate server item status', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'vessel-id' })
      })
      .mockResolvedValueOnce({ ok: false, status: 503 })
    const client = createVesselsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    await expect(client.getVessel('vessel-id')).rejects.toMatchObject({
      message: 'Vessels reference data returned an invalid response'
    })
    await expect(client.getVessel('vessel-id')).rejects.toMatchObject({
      statusCode: 503
    })
  })
})
