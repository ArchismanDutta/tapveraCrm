import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `.old`/`.backup` files are snapshots of pages that have since been
  // rewritten. Nothing imports them and they are not in the bundle, but they
  // were contributing a fifth of the repo's lint errors — noise that makes the
  // report worth less than the effort of reading it. Linting them tells us
  // nothing, because nobody is going to fix code that does not run.
  globalIgnores(['dist', 'src/**/*.old.jsx', 'src/**/*.backup.jsx']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        // Vite statically replaces `process.env.NODE_ENV` at build time (it is
        // defined by default, which is why the production bundle contains no
        // reference to `process` at all — the conditional in ErrorBoundary.jsx
        // is folded to `false` and dropped). Without declaring it here, the one
        // legitimate use in the codebase reports as `no-undef`, which is a
        // false positive — and a false `no-undef` is expensive, because
        // `no-undef` is the rule that catches genuine runtime ReferenceErrors.
        process: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^[A-Z_]',
          // A caught error you do not use is a deliberate choice, not an
          // oversight — `catch (error) { return fallback; }` is the whole
          // point. Flagging it trained everyone to skim past no-unused-vars,
          // which is where the reports that DO matter were getting lost.
          caughtErrors: 'none',
          // `^_` is the standard opt-out for a parameter that must exist to
          // reach a later one, or that a framework signature requires (e.g.
          // React's `getDerivedStateFromError(error)`).
          //
          // `^[A-Z]` matches what `varsIgnorePattern` already allows, and for
          // the same reason: this config has no eslint-plugin-react, so nothing
          // teaches it that a PascalCase identifier used only as `<Icon />` in
          // JSX counts as a use. That is fine for local variables — they are
          // covered above — but a component received as a PROP
          // (`({ icon: Icon }) => <Icon />`) is an argument, and was being
          // reported as unused despite being rendered.
          argsIgnorePattern: '^(_|[A-Z])',
        },
      ],
    },
  },
])
