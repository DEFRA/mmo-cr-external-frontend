import Joi from 'joi'

import { getData } from '#/server/common/data/get-data.js'
import { getStatusDisplay } from '#/server/common/helpers/records/status-display.js'
import { buildPagination } from '#/server/common/helpers/records/pagination.js'

const PAGE_SIZE = 10

function toRowViewModel(record) {
  const statusDisplay = getStatusDisplay(record.status)

  return {
    recordId: record.recordId,
    tripEndDate: record.tripEndDate,
    vesselName: record.vesselName,
    createdBy: record.createdBy,
    statusText: statusDisplay.text,
    statusTagClasses: statusDisplay.tagClasses,
    href: `/records/${record.recordId}`
  }
}

function toPaginationItems(pagination) {
  const items = []

  for (
    let pageNumber = 1;
    pageNumber <= pagination.pageCount;
    pageNumber += 1
  ) {
    items.push({
      number: String(pageNumber),
      current: pageNumber === pagination.currentPage,
      href: `/records?page=${pageNumber}`
    })
  }

  return items
}

/**
 * Landing page after sign in. Sources catch records from the Step 03 mock-data layer.
 */
export const recordsController = {
  options: {
    validate: {
      query: Joi.object({
        page: Joi.number().integer().min(1).optional()
      })
    }
  },
  handler(request, h) {
    const account = getData('account')
    const service = getData('service')
    const pagination = buildPagination({
      items: getData('allRecords'),
      page: request.query.page ?? 1,
      pageSize: PAGE_SIZE
    })

    return h.view('records/index', {
      pageTitle: `Catch records for ${account.name}`,
      heading: `Catch records for ${account.name}`,
      accountRole: account.role,
      notice: service.notice,
      records: pagination.pageItems.map(toRowViewModel),
      pagination,
      paginationItems: toPaginationItems(pagination)
    })
  }
}
