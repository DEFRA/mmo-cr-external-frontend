# Forgotten Password

- Source: user-provided screenshot, read 2026-10-22. User approved a frontend prototype with validation and confirmation; real email delivery is explicitly out of scope.
- Sign-in page link opens `/forgotten-password`. Back returns to `/sign-in`.
- Heading: Forgotten your password?
- Description: Enter your email address and we will send you a link to reset your password.
- Form: Email address input and green Send email button. Use GOV.UK input width 20, XL heading, body typography and spacing 8 after the heading as interpretations of the scaled screenshot.
- The form works without JavaScript. Blank or invalid input renders an error summary linked to the email field, an inline error and the submitted value.
- Valid POST redirects to `/forgotten-password-confirmation`. The latest confirmation screenshot supersedes the original generic design: a green GOV.UK panel reads "A reset password email has been sent to" and displays the submitted email. It is followed by What happens next, the reset-link and spam-folder paragraphs, and a Sign in button linking to `/sign-in`. No Back link is shown.
- The confirmation uses a two-thirds column. Scoped wrapping keeps long email addresses inside the panel at desktop and mobile widths. Panel colours and typography remain standard GOV.UK.
- No email is actually sent, no reset token is created, and authentication state does not change. Email delivery and production security controls for a real reset service require a separately scoped backend integration.
- The email is passed through a one-use session flash message, never a URL parameter, and cleared when confirmation is displayed. Direct visits or refreshes without a pending address return to the form. The panel uses escaped text. Existing security headers remain enabled.
- Shared layout owns the header, phase banner, Back link, language switcher and footer. No new assets or bespoke styling are needed.
- Existing signed-in Account reset routes are unchanged.
- Validation: sign-in link, form structure, missing/invalid email, generic success, return navigation, unchanged sign-in state and desktop/mobile overflow.