// Runs async actions one at a time, stopping at the first failure.
export function forEachSequentially(items, action) {
  return items.reduce(
    (previous, item) => previous.then(() => action(item)),
    Promise.resolve()
  )
}
