# Dual-Model Analysis

## Gemini

Blocked: `codeagent-wrapper --backend gemini` failed because no Gemini auth method is configured in the local environment. The wrapper requested one of `GEMINI_API_KEY`, `GOOGLE_GENAI_USE_VERTEXAI`, or `GOOGLE_GENAI_USE_GCA`.

## Claude

Key findings:

- Extension and Node proxy lifecycle are separate. The extension must handle a missing sidecar cleanly, and the sidecar must expose `/health`.
- Gemini Web sends full partial text updates, while OpenAI-compatible SSE expects deltas. The proxy must track sent length and emit only the new suffix.
- Multi-turn behavior must be implemented by flattening OpenAI `messages` / Responses `input` into one prompt because Gemini Web temporary chat is stateless.
- Port `8787` should be configurable.
- Add tests for stream delta conversion, OpenAI request validation, bridge disconnects, and bridge manager request handling.
