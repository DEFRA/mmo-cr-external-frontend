/**
 * The Catch Recording entry page. Structure/navigation only — the real guidance
 * content is out of scope for this step.
 */
export const guidanceController = {
  handler(_request, h) {
    return h.view('guidance/index', {
      pageTitle: 'Guidance',
      heading: 'Guidance'
    })
  }
}
