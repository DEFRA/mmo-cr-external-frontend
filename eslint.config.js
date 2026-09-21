import neostandard from 'neostandard'

export default [
  ...neostandard({
    env: ['node', 'vitest'],
    ignores: [...neostandard.resolveIgnoresFromGitignore()],
    noJsx: true,
    noStyle: true
  }),
  {
    // jsdom-provided DOM event constructors used in client-side test files.
    files: ['src/client/**/*.test.js'],
    languageOptions: {
      globals: {
        KeyboardEvent: 'readonly',
        PointerEvent: 'readonly',
        WheelEvent: 'readonly'
      }
    }
  }
]
