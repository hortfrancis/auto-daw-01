# AGENTS.md

## Project

- `server/`: Node process (Express). Serves `/api/*`, the MCP endpoint at `/mcp` (tools live in `server/mcp.ts`), and the UI. Node runs the `.ts` files directly, so use erasable TypeScript syntax only (no `enum` or `namespace`) and `.ts` import extensions.
- `web/`: browser UI, served by Vite running inside the server process on the same port. Gets project state pushed over a WebSocket at `/ws`. The UI is React; the audio engine is not. The engine follows project state directly, and components never create audio nodes or schedule sound (see "The audio engine is separate from the UI" in `docs/architecture.md`).
- `shared/`: types used by both server and web (project model, WebSocket messages).
- `docs/`: architecture and roadmap. We build in small spikes (see `docs/roadmap.md`).

## Agentic usability comes first

The LLM agent is this software's primary user. Design every MCP tool, result and error by [docs/agentic-usability.md](docs/agentic-usability.md), and run its checklist before adding or changing a tool. In short: self-evident tools, musical units, short results, errors that teach, safe to retry and undo, one call per whole job.

## Commands

- `npm run dev`: start everything at http://localhost:4747 (set `PORT` to change)
- `npm run typecheck`: typecheck server, web and tests
- `npm run test:e2e`: Playwright end-to-end tests (real server on port 4748, real browser, real MCP calls). First time: `npx playwright install chromium`. Run them after every change, and add a test for each new tool or UI behaviour in `e2e/`.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<optional scope>): <short summary>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`, `perf`, `style`.

Examples: `docs: add roadmap`, `feat(mcp): add get_project tool`, `fix(engine): stop notes drifting on loop`.
