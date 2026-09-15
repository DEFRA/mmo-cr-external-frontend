// Progressively reveals the optional below-minimum/legally-discarded weight
// inputs on the species selection page, without a full page round trip.
export function initSpeciesWeightToggle(root = document) {
  root.querySelectorAll('.js-weight-toggle').forEach((link) => {
    const target = document.getElementById(link.dataset.target)

    if (!target) {
      return
    }

    link.setAttribute(
      'aria-expanded',
      String(!target.classList.contains('govuk-visually-hidden'))
    )

    // Stops the mouse click itself from focusing the link, so the yellow
    // govuk focus style doesn't flash on a pointer click (still shows for
    // keyboard activation, which focuses the link before the click fires).
    link.addEventListener('mousedown', (event) => event.preventDefault())

    link.addEventListener('click', (event) => {
      event.preventDefault()

      const isHidden = target.classList.toggle('govuk-visually-hidden')

      link.textContent = isHidden
        ? link.dataset.addText
        : link.dataset.removeText
      link.setAttribute('aria-expanded', String(!isHidden))
      // Avoid the focus style lingering once the reveal/hide action has run.
      link.blur()
    })
  })
}
