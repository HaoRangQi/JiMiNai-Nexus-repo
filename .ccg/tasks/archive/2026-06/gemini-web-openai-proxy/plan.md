# Gemini Web Local OpenAI-Compatible Proxy

## Goal

Implement a local-only OpenAI-compatible API sidecar for Cherry Studio and LobeChat-style clients. The Node sidecar exposes `http://127.0.0.1:8787/v1`, while the Gemini Nexus extension connects back to it over `ws://127.0.0.1:8787/bridge` and executes requests through the existing Gemini Web provider and browser login state.

## Scope

- Add a Node sidecar under `proxy/` using native `http` plus `ws`.
- Add `npm run proxy:start`.
- Add extension settings for `Local API Bridge`: enabled toggle and WebSocket URL, default `ws://127.0.0.1:8787/bridge`.
- Add `background/managers/api_bridge_manager.js`, initialized from `background/index.js`.
- Keep Gemini Web calls inside the extension.
- Force bridge requests to use Gemini Web temporary chat by default.

## API Contract

- `GET /health`
- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/responses`

The first version is local-only and text-only. Unsupported tools, function calls, files, and image input return `400`.

## Verification

- `npm run test`
- `npm run build`
- `npm exec tsc -- --noEmit`
- `npm run lint:unused`
