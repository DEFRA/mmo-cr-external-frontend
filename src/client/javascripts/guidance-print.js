export function initialiseGuidancePrintButton() {
  const printButton = document.querySelector('[data-module="app-print-button"]')

  printButton?.addEventListener('click', () => window.print())
}
