import { createPortsReferenceDataClient } from './ports-reference-data.js'

const firstPort = {
  id: '00000000-0000-4000-8000-000000000031',
  code: 'GBPLY',
  name: 'Plymouth'
}
const secondPort = {
  id: '00000000-0000-4000-8000-000000000032',
  code: 'GB007',
  name: 'Newlyn'
}

function page(
  items,
  { total = items.length, offset = 0, etag = '"ports-v1"' } = {}
) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => etag },
    json: async () => ({ items, total, offset, limit: 50, version: 'v1' })
  }
}

describe('#createPortsReferenceDataClient', () => {
  test('Should fetch all pages and send each page its own ETag on refresh', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(page([firstPort], { total: 2, etag: '"first"' }))
      .mockResolvedValueOnce(
        page([secondPort], { total: 2, offset: 1, etag: '"second"' })
      )
      .mockResolvedValueOnce({ status: 304 })
      .mockResolvedValueOnce({ status: 304 })
    const client = createPortsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    expect((await client.getPorts()).map((port) => port.code)).toEqual([
      'GBPLY',
      'GB007'
    ])
    await client.getPorts()

    expect(fetchFn.mock.calls[0][0]).toContain('/ports?view=mobile&offset=0')
    expect(fetchFn.mock.calls[1][0]).toContain('&offset=1')
    expect(fetchFn.mock.calls[2][1].headers['If-None-Match']).toBe('"first"')
    expect(fetchFn.mock.calls[3][1].headers['If-None-Match']).toBe('"second"')
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer test-token'
    )
  })

  test('Should request an item by GUID', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => firstPort })
    const client = createPortsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    expect((await client.getPort(firstPort.id)).code).toBe('GBPLY')
    expect(fetchFn.mock.calls[0][0]).toContain(
      `/ports/${firstPort.id}?view=mobile`
    )
  })

  test('Should use the last complete catalogue after a later page fails', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(page([firstPort]))
      .mockResolvedValueOnce(page([firstPort], { total: 2 }))
      .mockRejectedValueOnce(new Error('network failure'))
    const client = createPortsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: 'test-token',
      fetchFn
    })

    const first = await client.getPorts()
    expect(await client.getPorts()).toBe(first)
  })

  test('Should not serve cached data without credentials', async () => {
    let token = 'test-token'
    const fetchFn = vi.fn().mockResolvedValue(page([firstPort]))
    const client = createPortsReferenceDataClient({
      serviceUrl: 'http://localhost:3002',
      token: () => token,
      fetchFn
    })

    await client.getPorts()
    token = undefined

    await expect(client.getPorts()).rejects.toThrow('not configured')
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })
})
