// Pure pagination view-model helper — no Hapi/request coupling.

function clampPage(page, pageCount) {
  const parsed = Number.isInteger(page) ? page : Number.parseInt(page, 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1
  }

  return Math.min(parsed, pageCount)
}

/**
 * Builds a pagination view model for a page of items: which items are on the
 * current page, and the "Showing X to Y of Z" totals. An out-of-range page
 * is clamped to the nearest valid page rather than throwing.
 */
export function buildPagination({ items = [], page = 1, pageSize = 10 } = {}) {
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = clampPage(page, pageCount)
  const startIndex = (currentPage - 1) * pageSize
  const pageItems = items.slice(startIndex, startIndex + pageSize)

  return {
    currentPage,
    pageSize,
    total,
    pageCount,
    firstItem: total === 0 ? 0 : startIndex + 1,
    lastItem: total === 0 ? 0 : startIndex + pageItems.length,
    pageItems,
    hasPrevious: currentPage > 1,
    hasNext: currentPage < pageCount
  }
}
