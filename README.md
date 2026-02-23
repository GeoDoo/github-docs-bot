# github-docs-bot

A GitHub App that automatically generates and maintains documentation for your codebase. When a pull request is opened or updated, the bot analyzes changed files, detects undocumented public APIs, generates documentation using an LLM, and commits the docs directly to the PR branch.

## How it works

```
PR opened/updated
       │
       ▼
Webhook fires → Bot receives event
       │
       ├─ Fetch changed files via GitHub API
       ├─ Parse code to find undocumented exports
       ├─ Generate docs via LLM (Anthropic or OpenAI)
       ├─ Commit doc updates to the PR branch (Git Trees API)
       └─ Report coverage via GitHub Check Run
```

### Key design decisions

- **Same-PR commits** — docs are added as a commit on the feature branch, not a separate PR. They're reviewed together with the code and can't go unmerged.
- **Single bot commit** — the default "amend" strategy keeps exactly one bot commit at the branch tip. On each push, the bot replaces its previous commit instead of stacking new ones.
- **Self-trigger guard** — the bot detects its own commits and skips them, preventing infinite loops.
- **Race condition handling** — if the branch moves while the bot is generating, it catches the 409 conflict and retries against the new HEAD.
- **No git clone** — all operations use the GitHub API (Git Trees, Blobs, Refs), making the bot fast and stateless.

## Supported languages

| Language | Extensions | Doc style |
|----------|-----------|-----------|
| TypeScript | `.ts`, `.tsx`, `.mts` | JSDoc |
| JavaScript | `.js`, `.jsx`, `.mjs` | JSDoc |
| Python | `.py` | Docstrings (NumPy, Google) |

More parsers can be added by implementing the `LanguageParser` interface.

## Setup

### 1. Register a GitHub App

Go to [github.com/settings/apps/new](https://github.com/settings/apps/new) and configure:

| Setting | Value |
|---------|-------|
| **Webhook URL** | Your server URL (or use [smee.io](https://smee.io) for local dev) |
| **Permissions** | `contents: write`, `pull_requests: write`, `checks: write`, `metadata: read` |
| **Events** | `Pull request` |

Download the private key (`.pem` file) after creation.

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in your `.env`:

```
APP_ID=123456
PRIVATE_KEY_PATH=./your-app.private-key.pem
WEBHOOK_SECRET=your-webhook-secret

# Pick one:
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### 3. Install and run

```bash
npm install
npm run build
npm start
```

For development with auto-reload:

```bash
npm run dev
```

### 4. Install the app on a repository

Go to your GitHub App's settings page and install it on the repositories you want to document.

## Repository configuration

Each repo can customize the bot's behavior by adding a `.github/docs-bot.yml` file:

```yaml
triggers:
  skip_draft: true
  skip_labels: ["no-docs", "wip"]

documentation:
  inline:
    enabled: true
    languages: [typescript, python]
    style: jsdoc          # jsdoc | google | numpy | rustdoc
    scope: exported_only  # exported_only | all

ai:
  provider: anthropic     # anthropic | openai
  model: claude-sonnet-4-20250514
  custom_instructions: |
    Use imperative mood for descriptions.
    Always include @example tags.

check:
  conclusion_on_missing: neutral  # success | failure | neutral

ignore:
  paths:
    - "**/*.test.ts"
    - "**/generated/**"
  patterns:
    - "_*"                # skip functions starting with _

commit:
  strategy: amend         # amend | append
  message: "docs: auto-update documentation [github-docs-bot]"
```

If no config file is present, sensible defaults are used (see `src/config/defaults.ts`).

## Architecture

```
src/
├── index.ts                  # Probot app entry — registers parsers and event handlers
├── types/index.ts            # TypeScript type definitions
├── config/
│   ├── defaults.ts           # Default configuration values
│   └── loader.ts             # Loads .github/docs-bot.yml with deep merge
├── handlers/
│   └── pull-request.ts       # Main orchestrator: analyze → generate → commit → report
├── services/
│   ├── github.ts             # GitHub API: file content, Git Trees commits, Check Runs
│   ├── analyzer.ts           # Scans changed files and finds documentation gaps
│   ├── generator.ts          # LLM-based doc generation + file content patching
│   └── committer.ts          # Commit strategy (amend / append) with conflict retry
└── parsers/
    ├── index.ts              # Parser registry
    ├── typescript.ts         # TS/JS regex-based parser for exports
    └── python.ts             # Python regex-based parser for defs/classes
```

## Testing

```bash
npm test
```

Tests cover:
- TypeScript parser: detection of undocumented exports, skip patterns, scope filtering
- Python parser: top-level functions/classes, docstring detection, private function handling
- Doc application: correct line insertion, multi-gap handling, indentation preservation
- Config defaults: sensible out-of-the-box values

## Adding a new language parser

1. Create `src/parsers/your-language.ts` implementing the `LanguageParser` interface
2. Register it in `src/index.ts` with `registerParser()`
3. Add test fixtures in `test/fixtures/sample-code/`
4. Add tests in `test/parsers/your-language.test.ts`

## Deployment

The bot is stateless and works well in serverless environments:

- **Vercel**: use the Probot adapter for Vercel
- **AWS Lambda**: use the Probot adapter for Lambda
- **Docker**: standard Node.js container
- **Any server**: `npm start` runs a long-lived HTTP server

## License

MIT
