const minimumSearchLength = 2
const maximumResults = 10

export function initialisePortSearch() {
  const input = document.querySelector('[data-port-search]')
  if (!input) return

  const results = document.querySelector('[data-port-results]')
  const dataScript = document.querySelector('[data-port-search-data]')

  let portNames = []
  try {
    portNames = JSON.parse(dataScript?.textContent || '[]')
  } catch {
    portNames = []
  }

  const selectPort = (name) => {
    input.value = name
    results.hidden = true
    results.replaceChildren()
    input.setAttribute('aria-expanded', 'false')
  }

  const renderResults = () => {
    const query = input.value.trim().toLowerCase()
    results.replaceChildren()

    if (query.length < minimumSearchLength) {
      results.hidden = true
      input.setAttribute('aria-expanded', 'false')
      return
    }

    const matches = portNames
      .filter((name) => name.toLowerCase().startsWith(query))
      .slice(0, maximumResults)

    if (!matches.length) {
      results.hidden = true
      input.setAttribute('aria-expanded', 'false')
      return
    }

    matches.forEach((name) => {
      const item = document.createElement('li')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'app-statistical-area-search__option'
      button.role = 'option'
      button.setAttribute('aria-selected', 'false')
      button.textContent = name
      button.addEventListener('click', () => selectPort(name))
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
}
