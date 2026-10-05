import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiBridgeManager } from './api_bridge_manager.js';

function createWebSocketHarness() {
    const instances = [];

    class FakeWebSocket {
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;

        constructor(url) {
            this.url = url;
            this.readyState = FakeWebSocket.CONNECTING;
            this.listeners = {};
            this.sent = [];
            instances.push(this);
        }

        addEventListener(type, listener) {
            if (!this.listeners[type]) {
                this.listeners[type] = [];
            }
            this.listeners[type].push(listener);
        }

        send(data) {
            this.sent.push(JSON.parse(data));
        }

        close() {
            this.readyState = FakeWebSocket.CLOSED;
        }

        emit(type, event = {}) {
            for (const listener of this.listeners[type] || []) {
                listener(event);
            }
        }

        open() {
            this.readyState = FakeWebSocket.OPEN;
            this.emit('open');
        }

        message(payload) {
            this.emit('message', {
                data: typeof payload === 'string' ? payload : JSON.stringify(payload),
            });
        }
    }

    return { FakeWebSocket, instances };
}

function setupChromeStorage({ enabled = false, url = 'ws://127.0.0.1:8787/bridge' } = {}) {
    const storageListeners = [];
    const storageState = {
        geminiApiBridgeEnabled: enabled,
        geminiApiBridgeUrl: url,
    };

    globalThis.chrome = {
        runtime: {
            getManifest: vi.fn(() => ({ version: '9.9.9' })),
        },
        storage: {
            local: {
                get: vi.fn(async (keys) => {
                    const result = {};
                    for (const key of keys) {
                        if (key in storageState) {
                            result[key] = storageState[key];
                        }
                    }
                    return result;
                }),
            },
            onChanged: {
                addListener: vi.fn((listener) => {
                    storageListeners.push(listener);
                }),
            },
        },
    };

    return {
        emitStorageChange(changes, areaName = 'local') {
            for (const listener of storageListeners) {
                listener(changes, areaName);
            }
        },
    };
}

describe('ApiBridgeManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('does not connect when the bridge is disabled', async () => {
        setupChromeStorage({ enabled: false });
        const { FakeWebSocket, instances } = createWebSocketHarness();
        const manager = new ApiBridgeManager({
            sessionManager: { handleSendPrompt: vi.fn() },
            WebSocketCtor: FakeWebSocket,
        });

        await manager.init();

        expect(instances).toHaveLength(0);
    });

    it('connects and sends hello when the bridge is enabled', async () => {
        setupChromeStorage({ enabled: true });
        const { FakeWebSocket, instances } = createWebSocketHarness();
        const manager = new ApiBridgeManager({
            sessionManager: { handleSendPrompt: vi.fn() },
            WebSocketCtor: FakeWebSocket,
        });

        await manager.init();
        expect(instances).toHaveLength(1);

        instances[0].open();

        expect(instances[0].url).toBe('ws://127.0.0.1:8787/bridge');
        expect(instances[0].sent).toContainEqual({
            type: 'hello',
            version: '9.9.9',
        });
    });

    it('handles ping messages with pong replies', async () => {
        setupChromeStorage({ enabled: true });
        const { FakeWebSocket, instances } = createWebSocketHarness();
        const manager = new ApiBridgeManager({
            sessionManager: { handleSendPrompt: vi.fn() },
            WebSocketCtor: FakeWebSocket,
        });

        await manager.init();
        instances[0].open();
        instances[0].message({ type: 'ping' });

        expect(instances[0].sent).toContainEqual({ type: 'pong' });
    });

    it('normalizes bridge requests before calling the web session manager', async () => {
        setupChromeStorage({ enabled: true });
        const { FakeWebSocket, instances } = createWebSocketHarness();
        const handleSendPrompt = vi.fn(async () => ({
            status: 'success',
            text: 'done',
            images: [],
        }));
        const manager = new ApiBridgeManager({
            sessionManager: { handleSendPrompt },
            WebSocketCtor: FakeWebSocket,
        });

        await manager.init();
        instances[0].open();
        instances[0].message({
            type: 'request',
            id: 'req-1',
            payload: {
                prompt: 'Hello from the sidecar',
                model: 'gemini-2.5-pro',
                thinkingLevel: 'high',
                webTemporaryChat: false,
            },
        });

        await vi.waitFor(() => expect(handleSendPrompt).toHaveBeenCalledTimes(1));
        expect(handleSendPrompt).toHaveBeenCalledWith(
            {
                provider: 'web',
                sessionId: 'api-bridge-req-1',
                text: 'Hello from the sidecar',
                model: 'gemini-2.5-pro',
                webThinkingLevel: 'high',
                webTemporaryChat: true,
                files: [],
            },
            expect.any(Function)
        );
    });

    it('streams partial updates back to the sidecar as full text', async () => {
        setupChromeStorage({ enabled: true });
        const { FakeWebSocket, instances } = createWebSocketHarness();
        const handleSendPrompt = vi.fn(async (request, onUpdate) => {
            onUpdate('Hel');
            onUpdate('Hello');
            return {
                status: 'success',
                text: 'Hello',
                images: [],
            };
        });
        const manager = new ApiBridgeManager({
            sessionManager: { handleSendPrompt },
            WebSocketCtor: FakeWebSocket,
        });

        await manager.init();
        instances[0].open();
        instances[0].message({
            type: 'request',
            id: 'req-2',
            payload: { prompt: 'stream please' },
        });

        await vi.waitFor(() =>
            expect(instances[0].sent.filter((message) => message.type === 'stream')).toHaveLength(2)
        );
        expect(instances[0].sent.filter((message) => message.type === 'stream')).toEqual([
            { type: 'stream', id: 'req-2', text: 'Hel' },
            { type: 'stream', id: 'req-2', text: 'Hello' },
        ]);
    });

    it('sends a result message when the web request succeeds', async () => {
        setupChromeStorage({ enabled: true });
        const { FakeWebSocket, instances } = createWebSocketHarness();
        const handleSendPrompt = vi.fn(async () => ({
            status: 'success',
            text: 'Final answer',
            images: ['image-1'],
        }));
        const manager = new ApiBridgeManager({
            sessionManager: { handleSendPrompt },
            WebSocketCtor: FakeWebSocket,
        });

        await manager.init();
        instances[0].open();
        instances[0].message({
            type: 'request',
            id: 'req-3',
            payload: { prompt: 'result please' },
        });

        await vi.waitFor(() =>
            expect(instances[0].sent).toContainEqual({
                type: 'result',
                id: 'req-3',
                text: 'Final answer',
                images: ['image-1'],
            })
        );
    });

    it('returns a busy error instead of overlapping requests', async () => {
        setupChromeStorage({ enabled: true });
        const { FakeWebSocket, instances } = createWebSocketHarness();
        let resolveFirstRequest;
        const handleSendPrompt = vi.fn(
            () =>
                new Promise((resolve) => {
                    resolveFirstRequest = resolve;
                })
        );
        const manager = new ApiBridgeManager({
            sessionManager: { handleSendPrompt },
            WebSocketCtor: FakeWebSocket,
        });

        await manager.init();
        instances[0].open();
        instances[0].message({
            type: 'request',
            id: 'req-4',
            payload: { prompt: 'first request' },
        });
        await vi.waitFor(() => expect(handleSendPrompt).toHaveBeenCalledTimes(1));

        instances[0].message({
            type: 'request',
            id: 'req-5',
            payload: { prompt: 'second request' },
        });

        expect(instances[0].sent).toContainEqual({
            type: 'error',
            id: 'req-5',
            message: 'API bridge is busy.',
        });

        resolveFirstRequest({
            status: 'success',
            text: 'done',
            images: [],
        });
    });
});
