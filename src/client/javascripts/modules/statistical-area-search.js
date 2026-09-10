const minimumSearchLength = 2
const maximumResults = 10

export async function initialiseStatisticalAreaSearch() {
  const input = document.querySelector('[data-statistical-area-search]')
  if (!input) return

  const searchPanel = document.querySelector('[data-statistical-area-search-panel]')
  const radioOptions = document.querySelector('[data-statistical-area-options]')
  const results = document.querySelector('[data-statistical-area-results]')

  try {
    const response = await fetch('/public/offline-map/subrectangles.json')
    if (!response.ok) return

    const { subrectangles } = await response.json()
    const selectSubrectangle = (subrectangle) => {
      input.value = subrectangle.subCode
      results.hidden = true
      results.replaceChildren()
      input.setAttribute('aria-expanded', 'false')
    }
    const renderResults = () => {
      const query = input.value.trim().toUpperCase()
      results.replaceChildren()

      if (query.length < minimumSearchLength) {
        results.hidden = true
        input.setAttribute('aria-expanded', 'false')
        return
      }

      const matches = subrectangles
        .filter((subrectangle) => subrectangle.subCode.startsWith(query))
        .slice(0, maximumResults)

      if (!matches.length) {
        results.hidden = true
        input.setAttribute('aria-expanded', 'false')
        return
      }

      matches.forEach((subrectangle) => {
        const item = document.createElement('li')
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'app-statistical-area-search__option'
        button.role = 'option'
        button.setAttribute('aria-selected', 'false')
        button.textContent = subrectangle.subCode
        button.addEventListener('click', () => selectSubrectangle(subrectangle))
        item.append(button)
        results.append(item)
      })
      results.hidden = false
      input.setAttribute('aria-expanded', 'true')
    }

    input.addEventListener('input', renderResults)
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        results.hidden = true
        input.setAttribute('aria-expanded', 'false')
      }
    })
    radioOptions?.addEventListener('change', (event) => {
      const isOther = event.target.value === 'other'
      searchPanel.hidden = !isOther
      results.hidden = true
      input.setAttribute('aria-expanded', 'false')
      if (isOther) input.focus()
    })
  } catch {
    results.hidden = true
  }
}