import { buildPagination } from './pagination.js'

const fourItems = ['a', 'b', 'c', 'd']

describe('#buildPagination', () => {
  test('Should show all 4 items on a single truthful page', () => {
    const pagination = buildPagination({
      items: fourItems,
      page: 1,
      pageSize: 10
    })

    expect(pagination).toEqual({
      currentPage: 1,
      pageSize: 10,
      total: 4,
      pageCount: 1,
      firstItem: 1,
      lastItem: 4,
      pageItems: fourItems,
      hasPrevious: false,
      hasNext: false
    })
  })

  test('Should default to page 1 and a pageSize of 10', () => {
    const pagination = buildPagination({ items: fourItems })

    expect(pagination.currentPage).toBe(1)
    expect(pagination.pageSize).toBe(10)
  })

  test('Should split items across multiple pages', () => {
    const items = Array.from({ length: 12 }, (_, index) => index)

    const firstPage = buildPagination({ items, page: 1, pageSize: 10 })
    expect(firstPage.pageItems).toHaveLength(10)
    expect(firstPage.firstItem).toBe(1)
    expect(firstPage.lastItem).toBe(10)
    expect(firstPage.hasNext).toBe(true)
    expect(firstPage.hasPrevious).toBe(false)

    const secondPage = buildPagination({ items, page: 2, pageSize: 10 })
    expect(secondPage.pageItems).toHaveLength(2)
    expect(secondPage.firstItem).toBe(11)
    expect(secondPage.lastItem).toBe(12)
    expect(secondPage.hasNext).toBe(false)
    expect(secondPage.hasPrevious).toBe(true)
  })

  test('Should clamp an out-of-range page to the last valid page', () => {
    const pagination = buildPagination({
      items: fourItems,
      page: 99,
      pageSize: 10
    })

    expect(pagination.currentPage).toBe(1)
  })

  test('Should clamp a page below 1 to the first page', () => {
    const pagination = buildPagination({
      items: fourItems,
      page: 0,
      pageSize: 10
    })

    expect(pagination.currentPage).toBe(1)
  })

  test('Should clamp a non-numeric page to the first page', () => {
    const pagination = buildPagination({
      items: fourItems,
      page: 'not-a-number',
      pageSize: 10
    })

    expect(pagination.currentPage).toBe(1)
  })

  test('Should handle an empty item list', () => {
    const pagination = buildPagination({ items: [], page: 1, pageSize: 10 })

    expect(pagination.total).toBe(0)
    expect(pagination.firstItem).toBe(0)
    expect(pagination.lastItem).toBe(0)
    expect(pagination.pageItems).toEqual([])
  })
})
