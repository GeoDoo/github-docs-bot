# github-docs-bot

A GitHub App that automatically generates and maintains documentation for your codebase.

- **On install** — runs a full-repo scan, generates docs for all undocumented APIs, and opens a bootstrap PR.
- **On every PR** — analyzes changed files, generates docs for new/modified code, and commits directly to the feature branch.
- **Public vs Internal** — every documented element is classified by visibility and rendered into separate reference files: `docs/API.md` (public contract) and `docs/INTERNALS.md` (implementation details).

## How it works

```
                    ┌─────────────────────────────────────────┐
                    │           github-docs-bot               │
                    └──────────┬──────────────┬───────────────┘
                               │              │
            ┌──────────────────┘              └──────────────────┐
            ▼                                                    ▼
   App installed on repo                               PR opened/updated
            │                                                    │
   ┌────────┴────────┐                                ┌──────────┴──────────┐
   │   BOOTSTRAP     │                                │   INCREMENTAL       │
   │                 │                                │                     │
   │ Git Trees API   │                                │ pulls.listFiles     │
   │ → full file     │                                │ → changed files     │
   │   tree scan     │                                │   only              │
   │                 │                                │                     │
   │ LLM: find gaps  │                                │ LLM: find gaps      │
   │ + generate docs │                                │ + generate docs     │
   │ Create branch   │                                │ Commit to PR branch │
   │ Open PR         │                                │ Update Check Run    │
   └─────────────────┘                                └─────────────────────┘
```

### Key design decisions

- **Bootstrap on install** — when the app is first installed, it scans the entire repo and opens a single PR with documentation for all existing undocumented code. No backlog left behind.
- **Same-PR commits** — incremental docs are added as a commit on the feature branch, not a separate PR. They're reviewed together with the code and can't go unmerged.
- **Single bot commit** — the default "amend" strategy keeps exactly one bot commit at the branch tip. On each push, the bot replaces its previous commit instead of stacking new ones.
- **Self-trigger guard** — the bot detects its own commits and skips them, preventing infinite loops.
- **Race condition handling** — if the branch moves while the bot is generating, it catches the 409 conflict and retries against the new HEAD.
- **No git clone** — all operations use the GitHub API (Git Trees, Blobs, Refs), making the bot fast and stateless.
- **Duplicate protection** — the bootstrap handler checks if the branch already exists before running, so re-installing the app won't create duplicate PRs.
- **LLM-first, no parsers** — the LLM handles language detection, gap finding, and doc generation in a single call per file. No regex parsers to maintain. Works with any language out of the box.

## Supported languages

Any language the LLM understands — which is all of them. The bot auto-detects the language from the file and uses the idiomatic doc style:

| Language | Doc style |
|----------|-----------|
| TypeScript / JavaScript | JSDoc (`/** */`) |
| Python | Docstrings (`"""`) |
| Java / Kotlin | Javadoc (`/** */`) |
| Go | Go doc comments (`//`) |
| Rust | Rustdoc (`///`) |
| C# | XML docs (`///`) |
| Ruby | YARD (`#`) |
| C / C++ | Doxygen (`/**`) |
| Swift | Swift doc (`///`) |
| PHP, Dart, Scala, Elixir, ... | Language-native style |

No parser plugins needed. If the LLM can read it, the bot can document it.

## Setup

### 1. Register a GitHub App

Go to [github.com/settings/apps/new](https://github.com/settings/apps/new) and configure:

| Setting | Value |
|---------|-------|
| **Webhook URL** | Your server URL (or use [smee.io](https://smee.io) for local dev) |
| **Permissions** | `contents: write`, `pull_requests: write`, `checks: write`, `metadata: read` |
| **Events** | `Pull request`, `Installation` |

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

Go to your GitHub App's settings page and install it on the repositories you want to document. The bot will immediately open a bootstrap PR for any repo with undocumented code.

## Repository configuration

Each repo can customize the bot's behavior by adding a `.github/docs-bot.yml` file:

```yaml
triggers:
  skip_draft: true
  skip_labels: ["no-docs", "wip"]

documentation:
  inline:
    enabled: true
    style: auto            # auto | jsdoc | google | numpy | rustdoc | javadoc
    scope: exported_only   # exported_only | all
  reference:
    enabled: true          # Generate docs/API.md and docs/INTERNALS.md
    output_dir: docs       # Where to write the reference files

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

commit:
  strategy: amend         # amend | append
  message: "docs: auto-update documentation [github-docs-bot]"

bootstrap:
  enabled: true           # Run full-repo scan on install
  max_files_per_pr: 50    # Cap to avoid huge PRs
  branch: "docs/initial-documentation"
```

If no config file is present, sensible defaults are used (see `src/config/defaults.ts`).

## Architecture

```
src/
├── index.ts                  # Probot app entry — registers event handlers
├── types/index.ts            # Shared types: RepoRef, BotConfig, FileUpdate, etc.
├── config/
│   ├── defaults.ts           # Default configuration values
│   └── loader.ts             # Loads .github/docs-bot.yml with deep merge
├── handlers/
│   ├── pull-request.ts       # PR handler: document → commit → check run
│   └── installation.ts       # Installation handler: triggers bootstrap for each repo
└── services/
    ├── github.ts             # GitHub API: trees, commits, branches, PRs, check runs
    ├── extensions.ts         # Code file extension registry (filter gate for the LLM)
    ├── documenter.ts         # Unified LLM pipeline: fetch → analyze → generate → apply
    ├── committer.ts          # Commit strategy (amend / append) with conflict retry
    └── bootstrap.ts          # Full-repo scan → branch → commit → open PR
```

## Testing

```bash
npm test
```

Tests cover:
- Code file extension registry: recognizes 30+ code file types, rejects non-code
- Doc insertion application: correct line placement, multi-file, indentation preservation
- Reference doc generation: public/internal separation, file grouping, custom output dirs
- Config defaults: sensible out-of-the-box values (bootstrap, reference docs, ignore paths)

## Adding support for new file types

The bot already supports any language the LLM understands. To add a new file
extension to the code file filter, add it to the `CODE_EXTENSIONS` set in
`src/services/extensions.ts`. That's it — the LLM handles everything else.

## Deployment

The bot is stateless and works well in serverless environments:

- **Vercel**: use the Probot adapter for Vercel
- **AWS Lambda**: use the Probot adapter for Lambda
- **Docker**: standard Node.js container
- **Any server**: `npm start` runs a long-lived HTTP server

## License

MIT
