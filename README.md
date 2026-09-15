# Auto DAW

An MCP-first digital audio workstation. An LLM makes the music over MCP; you watch and listen in a web UI. It runs locally and uses the Web Audio API.

**Status:** early days. See the roadmap.

## Run

Needs Node 22.18+.

```sh
npm install
npm run dev
```

Then open http://localhost:4747.

## Connect an MCP client

The MCP endpoint is `http://localhost:4747/mcp` (Streamable HTTP). Claude Code picks it up from `.mcp.json` in this repo: start Claude Code here and approve `auto-daw` when asked (or check it with `/mcp`).

- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
