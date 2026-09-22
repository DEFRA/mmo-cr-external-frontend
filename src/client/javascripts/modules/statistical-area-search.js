const minimumSearchLength = 2
const maximumResults = 10
const collapsedState = 'false'
const ariaExpandedAttribute = 'aria-expanded'

function queryElements() {
  return {
    input: document.querySelector('[data-statistical-area-search]'),
    searchPanel: document.querySelector('[data-statistical-area-search-panel]'),
    radioOptions: document.querySelector('[data-statistical-area-options]'),
    results: document.querySelector('[data-statistical-area-results]'),
    coordinates: document.querySelector('[data-statistical-area-coordinates]'),
    coordinatesValue: document.querySelector(
      '[data-statistical-area-coordinates-value]'
    )
  }
}

function findBySubCode(subrectangles, code) {
  return subrectangles.find((subrectangle) => subrectangle.subCode === code)
}

function formatCoordinate([longitude, latitude]) {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
}

function formatResultDetail(subrectangle) {
  const icesRectangle = subrectangle.subCode.slice(0, -1)
  return subrectangle.labelCoordinate
    ? `ICES rectangle ${icesRectangle} \u00b7 ${formatCoordinate(subrectangle.labelCoordinate)}`
    : `ICES rectangle ${icesRectangle}`
}

function showCoordinates({ coordinates, coordinatesValue }, subrectangle) {
  if (!coordinates || !coordinatesValue) {
    return
  }
  if (!subrectangle?.labelCoordinate) {
    coordinates.hidden = true
    coordinatesValue.textContent = ''
    return
  }
  coordinatesValue.textContent = formatCoordinate(subrectangle.labelCoordinate)
  coordinates.hidden = false
}

function collapseResults({ input, results }) {
  results.hidden = true
  input.setAttribute(ariaExpandedAttribute, collapsedState)
}

function selectSubrectangle(elements, subrectangle) {
  const { input, results } = elements
  input.value = subrectangle.subCode
  results.replaceChildren()
  collapseResults(elements)
  showCoordinates(elements, subrectangle)
}

function createResultItem(elements, subrectangle) {
  const item = document.createElement('li')
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'app-statistical-area-search__option'
  button.role = 'option'
  button.setAttribute('aria-selected', collapsedState)

  const code = document.createElement('span')
  code.className = 'app-statistical-area-search__option-code'
  code.textContent = subrectangle.subCode

  const detail = document.createElement('span')
  detail.className = 'app-statistical-area-search__option-detail'
  detail.textContent = formatResultDetail(subrectangle)

  button.append(code, detail)
  button.addEventListener('click', () =>
    selectSubrectangle(elements, subrectangle)
  )
  item.append(button)
  return item
}

function renderResults(elements, subrectangles) {
  const { input, results } = elements
  const query = input.value.trim().toUpperCase()
  results.replaceChildren()
  showCoordinates(elements, findBySubCode(subrectangles, query))

  if (query.length < minimumSearchLength) {
    collapseResults(elements)
    return
  }

  const matches = subrectangles
    .filter((subrectangle) => subrectangle.subCode.startsWith(query))
    .slice(0, maximumResults)

  if (!matches.length) {
    collapseResults(elements)
    return
  }

  matches.forEach((subrectangle) => {
    results.append(createResultItem(elements, subrectangle))
  })
  results.hidden = false
  input.setAttribute(ariaExpandedAttribute, 'true')
}

function handleRadioOptionChange(elements, subrectangles, event) {
  const { input, searchPanel } = elements
  const value = event.target.value
  const isOther = value === 'other'
  searchPanel.hidden = !isOther
  collapseResults(elements)
  showCoordinates(
    elements,
    isOther
      ? findBySubCode(subrectangles, input.value.trim().toUpperCase())
      : findBySubCode(subrectangles, value)
  )
  if (isOther) {
    input.focus()
  }
}

function attachEventListeners(elements, subrectangles) {
  const { input, radioOptions } = elements

  input.addEventListener('input', () => renderResults(elements, subrectangles))
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      collapseResults(elements)
    }
  })
  radioOptions?.addEventListener('change', (event) =>
    handleRadioOptionChange(elements, subrectangles, event)
  )
}

export async function initialiseStatisticalAreaSearch() {
  const elements = queryElements()
  if (!elements.input) {
    return
  }

  try {
    const response = await fetch('/public/offline-map/subrectangles.json')
    if (!response.ok) {
      return
    }

    const { subrectangles } = await response.json()
    attachEventListeners(elements, subrectangles)
  } catch {
    elements.results.hidden = true
  }
}
