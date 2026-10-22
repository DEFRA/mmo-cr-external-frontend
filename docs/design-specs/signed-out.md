# Signed-Out Confirmation

- Source: user-supplied screenshot, read 2026-10-22; implementation approved in conversation. No measured viewport or Figma version is available.
- After the existing POST-only sign-out action clears authentication and journey state, redirect with HTTP 303 to `/signed-out`.
- GET `/signed-out` only renders confirmation; GET `/sign-out` remains unavailable and cannot change session state.
- Heading: You have been signed out.
- Main content repeats the feedback sentence shown in the screenshot and uses the existing configured feedback URL.
- A green GOV.UK Sign in button links to `/sign-in`, without automatically signing the user in.
- Inherit the existing header, Beta banner, language switcher, footer, OGL and copyright. Do not add a Back link or signed-in navigation after sign-out.
- Layout: full-width GOV.UK content column with an XL heading. Heading-to-content spacing uses GOV.UK spacing 8 as an interpretation of the scaled screenshot, not a measured value.
- Accessibility: one H1, native feedback link, GOV.UK button link and existing visible focus styles. Content and navigation work without JavaScript.
- No new assets, bespoke colours, design-system deviations or authentication mechanism changes.
- Verify confirmation content, the return-to-sign-in link, unchanged session clearing, repeated sign-out safety, POST-only sign-out and resistance to arbitrary return destinations.