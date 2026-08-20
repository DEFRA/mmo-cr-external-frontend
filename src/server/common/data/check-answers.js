// Walkthrough-only mock data — fictional, not persisted.
// The only genuinely new fallback value: no gear/pots reference data has a
// mesh size anywhere in the app. Every other "missing answer" fallback below
// reuses `catchRecordDetails`, which already carries the exact PNG example
// values (same-day dates, ports, statistical sub area, species, weights,
// not-landed detail) — see check-answers/view-model.js.
export const checkAnswersDefaults = {
  potsMeshSize: '50 mm'
}
