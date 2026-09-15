# Auto DAW

An MCP-first digital audio workstation. An LLM makes the music over MCP; you watch and listen in a web UI. It runs locally and uses the Web Audio API.

**Status:** early days. See the roadmap.

## Run

Needs Node 22.18+.

```sh
npm install
npm run dev
```

Then open http://localhost:4747. Your project saves automatically to `projects/default/project.json`.

Tests: `npx playwright install chromium` once, then `npm run test:e2e`.

## Connect an MCP client

The MCP endpoint is `http://localhost:4747/mcp` (Streamable HTTP). Claude Code picks it up from `.mcp.json` in this repo: start Claude Code here and approve `auto-daw` when asked (or check it with `/mcp`).

- [Agentic usability](docs/agentic-usability.md): how we design for the LLM as the primary user
- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
