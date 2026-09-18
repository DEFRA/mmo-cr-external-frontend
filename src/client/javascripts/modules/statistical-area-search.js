const minimumSearchLength = 2
const maximumResults = 10
const collapsedState = 'false'
const ariaExpandedAttribute = 'aria-expanded'

export async function initialiseStatisticalAreaSearch() {
  const input = document.querySelector('[data-statistical-area-search]')
  if (!input) {
    return
  }

  const searchPanel = document.querySelector(
    '[data-statistical-area-search-panel]'
  )
  const radioOptions = document.querySelector('[data-statistical-area-options]')
  const results = document.querySelector('[data-statistical-area-results]')
  const coordinates = document.querySelector(
    '[data-statistical-area-coordinates]'
  )
  const coordinatesValue = document.querySelector(
    '[data-statistical-area-coordinates-value]'
  )

  try {
    const response = await fetch('/public/offline-map/subrectangles.json')
    if (!response.ok) {
      return
    }

    const { subrectangles } = await response.json()
    const findBySubCode = (code) =>
      subrectangles.find((subrectangle) => subrectangle.subCode === code)
    const formatCoordinate = ([longitude, latitude]) =>
      `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
    const formatResultDetail = (subrectangle) => {
      const icesRectangle = subrectangle.subCode.slice(0, -1)
      return subrectangle.labelCoordinate
        ? `ICES rectangle ${icesRectangle} \u00b7 ${formatCoordinate(subrectangle.labelCoordinate)}`
        : `ICES rectangle ${icesRectangle}`
    }
    const showCoordinates = (subrectangle) => {
      if (!coordinates || !coordinatesValue) {
        return
      }
      if (!subrectangle?.labelCoordinate) {
        coordinates.hidden = true
        coordinatesValue.textContent = ''
        return
      }
      coordinatesValue.textContent = formatCoordinate(
        subrectangle.labelCoordinate
      )
      coordinates.hidden = false
    }
    const selectSubrectangle = (subrectangle) => {
      input.value = subrectangle.subCode
      results.hidden = true
      results.replaceChildren()
      input.setAttribute(ariaExpandedAttribute, collapsedState)
      showCoordinates(subrectangle)
    }
    const renderResults = () => {
      const query = input.value.trim().toUpperCase()
      results.replaceChildren()
      showCoordinates(findBySubCode(query))

      if (query.length < minimumSearchLength) {
        results.hidden = true
        input.setAttribute(ariaExpandedAttribute, collapsedState)
        return
      }

      const matches = subrectangles
        .filter((subrectangle) => subrectangle.subCode.startsWith(query))
        .slice(0, maximumResults)

      if (!matches.length) {
        results.hidden = true
        input.setAttribute(ariaExpandedAttribute, collapsedState)
        return
      }

      matches.forEach((subrectangle) => {
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
        button.addEventListener('click', () => selectSubrectangle(subrectangle))
        item.append(button)
        results.append(item)
      })
      results.hidden = false
      input.setAttribute(ariaExpandedAttribute, 'true')
    }

    input.addEventListener('input', renderResults)
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        results.hidden = true
        input.setAttribute(ariaExpandedAttribute, collapsedState)
      }
    })
    radioOptions?.addEventListener('change', (event) => {
      const value = event.target.value
      const isOther = value === 'other'
      searchPanel.hidden = !isOther
      results.hidden = true
      input.setAttribute(ariaExpandedAttribute, collapsedState)
      showCoordinates(
        isOther
          ? findBySubCode(input.value.trim().toUpperCase())
          : findBySubCode(value)
      )
      if (isOther) {
        input.focus()
      }
    })
  } catch {
    results.hidden = true
  }
}
