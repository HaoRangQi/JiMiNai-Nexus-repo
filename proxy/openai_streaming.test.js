import { describe, expect, it, vi } from 'vitest';
import { ProxyError } from './errors.js';
import { handleChatCompletions } from './openai_chat.js';
import { handleResponses } from './openai_responses.js';

function createResponse() {
    return {
        writeHead: vi.fn(),
        write: vi.fn(),
        end: vi.fn(),
    };
}

describe('OpenAI streaming handlers', () => {
    it('returns bridge preflight errors before opening chat SSE', async () => {
        const response = createResponse();
        const bridge = {
            assertCanAcceptRequest: vi.fn(() => {
                throw new ProxyError(503, 'Extension API bridge is not connected.');
            }),
            sendRequest: vi.fn(),
        };

        await expect(
            handleChatCompletions({
                body: {
                    model: 'gemini-web-3.5-flash',
                    stream: true,
                    messages: [{ role: 'user', content: 'hello' }],
                },
                bridge,
                response,
                sendJson: vi.fn(),
            })
        ).rejects.toMatchObject({ status: 503 });

        expect(response.writeHead).not.toHaveBeenCalled();
        expect(bridge.sendRequest).not.toHaveBeenCalled();
    });

    it('returns bridge preflight errors before opening Responses SSE', async () => {
        const response = createResponse();
        const bridge = {
            assertCanAcceptRequest: vi.fn(() => {
                throw new ProxyError(429, 'API bridge request queue is full.');
            }),
            sendRequest: vi.fn(),
        };

        await expect(
            handleResponses({
                body: {
                    model: 'gemini-web-3.5-flash',
                    stream: true,
                    input: 'hello',
                },
                bridge,
                response,
                sendJson: vi.fn(),
            })
        ).rejects.toMatchObject({ status: 429 });

        expect(response.writeHead).not.toHaveBeenCalled();
        expect(bridge.sendRequest).not.toHaveBeenCalled();
    });
});
