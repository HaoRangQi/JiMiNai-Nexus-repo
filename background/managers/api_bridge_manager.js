import { DEFAULT_API_BRIDGE_URL } from '../../shared/config/constants.js';

const STORAGE_KEYS = ['geminiApiBridgeEnabled', 'geminiApiBridgeUrl'];
const RECONNECT_DELAYS_MS = Object.freeze([1000, 2000, 5000, 10000, 30000]);

function getManifestVersion() {
    try {
        return chrome.runtime.getManifest().version;
    } catch {
        return 'unknown';
    }
}

function parseBridgeMessage(event) {
    try {
        return JSON.parse(event?.data || '{}');
    } catch {
        return null;
    }
}

export class ApiBridgeManager {
    constructor({
        sessionManager,
        getStorage,
        WebSocketCtor,
        setTimeoutFn = setTimeout,
        clearTimeoutFn = clearTimeout,
    }) {
        this.sessionManager = sessionManager;
        this.getStorage = getStorage || ((keys) => chrome.storage.local.get(keys));
        this.WebSocketCtor = WebSocketCtor || globalThis.WebSocket;
        this.setTimeoutFn = setTimeoutFn;
        this.clearTimeoutFn = clearTimeoutFn;

        this.enabled = false;
        this.url = DEFAULT_API_BRIDGE_URL;
        this.ws = null;
        this.reconnectTimer = null;
        this.reconnectAttempt = 0;
        this.processingRequestId = null;
        this.storageListener = this.handleStorageChange.bind(this);
    }

    async init() {
        const settings = await this.readSettings();
        this.enabled = settings.enabled;
        this.url = settings.url;

        chrome.storage?.onChanged?.addListener?.(this.storageListener);

        if (this.enabled) {
            this.connect();
        }
    }

    async readSettings() {
        const stored = await this.getStorage(STORAGE_KEYS);
        return {
            enabled: stored.geminiApiBridgeEnabled === true,
            url: stored.geminiApiBridgeUrl || DEFAULT_API_BRIDGE_URL,
        };
    }

    async handleStorageChange(changes, areaName) {
        if (areaName !== 'local') return;
        if (!changes.geminiApiBridgeEnabled && !changes.geminiApiBridgeUrl) return;

        const settings = await this.readSettings();
        const shouldReconnect = this.enabled !== settings.enabled || this.url !== settings.url;
        this.enabled = settings.enabled;
        this.url = settings.url;

        if (!shouldReconnect) return;
        this.disconnect();
        if (this.enabled) this.connect();
    }

    connect() {
        if (!this.enabled || this.ws) return;
        if (!this.WebSocketCtor) {
            console.warn('[Gemini Nexus] API bridge WebSocket is unavailable.');
            return;
        }

        try {
            const ws = new this.WebSocketCtor(this.url);
            this.ws = ws;
            ws.addEventListener('open', () => this.handleOpen(ws));
            ws.addEventListener('message', (event) => this.handleMessage(ws, event));
            ws.addEventListener('error', (error) => {
                console.warn(`[Gemini Nexus] API bridge connection failed: ${this.url}`, error);
            });
            ws.addEventListener('close', () => this.handleClose(ws));
        } catch (error) {
            console.warn('[Gemini Nexus] API bridge connection failed:', error);
            this.ws = null;
            this.scheduleReconnect();
        }
    }

    handleOpen(ws) {
        if (this.ws !== ws) return;
        this.reconnectAttempt = 0;
        this.send({ type: 'hello', version: getManifestVersion() });
    }

    handleClose(ws) {
        if (this.ws !== ws) return;
        this.ws = null;
        this.processingRequestId = null;
        this.scheduleReconnect();
    }

    scheduleReconnect() {
        if (!this.enabled || this.reconnectTimer) return;
        const delay =
            RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
        this.reconnectAttempt += 1;
        this.reconnectTimer = this.setTimeoutFn(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delay);
    }

    disconnect() {
        if (this.reconnectTimer) {
            this.clearTimeoutFn(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            const ws = this.ws;
            this.ws = null;
            try {
                ws.close();
            } catch {}
        }
        this.processingRequestId = null;
        this.reconnectAttempt = 0;
    }

    handleMessage(ws, event) {
        if (this.ws !== ws) return;
        const message = parseBridgeMessage(event);
        if (!message || typeof message.type !== 'string') return;

        if (message.type === 'ping') {
            this.send({ type: 'pong' });
            return;
        }

        if (message.type === 'request') {
            this.handleRequest(message).catch((error) => {
                this.send({
                    type: 'error',
                    id: message.id,
                    message: error?.message || 'API bridge request failed.',
                });
            });
        }
    }

    async handleRequest(message) {
        const id = String(message.id || '');
        if (!id) return;

        if (this.processingRequestId) {
            this.send({ type: 'error', id, message: 'API bridge is busy.' });
            return;
        }

        this.processingRequestId = id;
        const payload = message.payload || {};

        try {
            const request = {
                provider: 'web',
                sessionId: `api-bridge-${id}`,
                text: String(payload.prompt || ''),
                model: payload.model,
                webTemporaryChat: true,
                files: [],
            };
            if (payload.thinkingLevel) {
                request.webThinkingLevel = payload.thinkingLevel;
            }

            const result = await this.sessionManager.handleSendPrompt(request, (partialText) => {
                this.send({ type: 'stream', id, text: partialText || '' });
            });

            if (result?.status === 'success') {
                this.send({
                    type: 'result',
                    id,
                    text: result.text || '',
                    images: Array.isArray(result.images) ? result.images : [],
                });
                return;
            }

            this.send({
                type: 'error',
                id,
                message: result?.text || 'Gemini Web request failed.',
            });
        } finally {
            if (this.processingRequestId === id) {
                this.processingRequestId = null;
            }
        }
    }

    send(message) {
        if (!this.ws || !this.WebSocketCtor || this.ws.readyState !== this.WebSocketCtor.OPEN) {
            return;
        }
        try {
            this.ws.send(JSON.stringify(message));
        } catch (error) {
            console.warn('[Gemini Nexus] API bridge send failed:', error);
        }
    }
}
