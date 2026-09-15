# AGENTS.md

## Project

- `server/`: Node process (Express). Node runs the `.ts` files directly, so use erasable TypeScript syntax only (no `enum` or `namespace`) and `.ts` import extensions.
- `web/`: browser UI, served by Vite running inside the server process on the same port.
- `docs/`: architecture and roadmap. We build in small spikes (see `docs/roadmap.md`).

## Commands

- `npm run dev`: start everything at http://localhost:4747 (set `PORT` to change)
- `npm run typecheck`: typecheck server and web

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<optional scope>): <short summary>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`, `perf`, `style`.

Examples: `docs: add roadmap`, `feat(mcp): add get_project tool`, `fix(engine): stop notes drifting on loop`.
