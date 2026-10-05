import { WebSocketServer, WebSocket } from 'ws';
import { ProxyError } from './errors.js';

function createRequestId() {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseJson(data) {
    try {
        return JSON.parse(String(data || '{}'));
    } catch {
        return null;
    }
}

export class BridgeServer {
    constructor({ queueLimit = 4 } = {}) {
        this.queueLimit = queueLimit;
        this.wss = null;
        this.socket = null;
        this.activeRequest = null;
        this.queue = [];
    }

    attach(httpServer) {
        this.wss = new WebSocketServer({ server: httpServer, path: '/bridge' });
        this.wss.on('connection', (socket) => this.handleConnection(socket));
    }

    isConnected() {
        return this.socket?.readyState === WebSocket.OPEN;
    }

    handleConnection(socket) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'replaced' }));
            this.socket.close();
        }

        this.socket = socket;
        socket.on('message', (data) => this.handleMessage(data));
        socket.on('close', () => this.handleDisconnect(socket));
        socket.on('error', () => this.handleDisconnect(socket));
        this.pumpQueue();
    }

    handleDisconnect(socket) {
        if (this.socket !== socket) return;
        this.socket = null;
        this.rejectActiveAndQueued(new ProxyError(503, 'Extension API bridge disconnected.'));
    }

    handleMessage(data) {
        const message = parseJson(data);
        if (!message || typeof message.type !== 'string') return;
        if (message.type === 'hello' || message.type === 'pong') return;
        if (!message.id || !this.activeRequest || message.id !== this.activeRequest.id) return;

        if (message.type === 'stream') {
            this.activeRequest.onStream?.(message.text || '');
            return;
        }

        if (message.type === 'result') {
            const active = this.activeRequest;
            this.activeRequest = null;
            active.resolve({
                text: message.text || '',
                images: Array.isArray(message.images) ? message.images : [],
            });
            this.pumpQueue();
            return;
        }

        if (message.type === 'error') {
            const active = this.activeRequest;
            this.activeRequest = null;
            active.reject(new ProxyError(502, message.message || 'Extension API bridge error.'));
            this.pumpQueue();
        }
    }

    sendRequest(payload, { onStream } = {}) {
        try {
            this.assertCanAcceptRequest();
        } catch (error) {
            return Promise.reject(error);
        }

        return new Promise((resolve, reject) => {
            this.queue.push({
                id: createRequestId(),
                payload,
                onStream,
                resolve,
                reject,
            });
            this.pumpQueue();
        });
    }

    assertCanAcceptRequest() {
        if (!this.isConnected()) {
            throw new ProxyError(503, 'Extension API bridge is not connected.');
        }

        if (this.activeRequest && this.queue.length >= this.queueLimit) {
            throw new ProxyError(429, 'API bridge request queue is full.');
        }
    }

    pumpQueue() {
        if (this.activeRequest || !this.isConnected()) return;
        const next = this.queue.shift();
        if (!next) return;

        this.activeRequest = next;
        this.sendJson({
            type: 'request',
            id: next.id,
            payload: next.payload,
        });
    }

    sendJson(payload) {
        if (!this.isConnected()) return false;
        this.socket.send(JSON.stringify(payload));
        return true;
    }

    rejectActiveAndQueued(error) {
        if (this.activeRequest) {
            this.activeRequest.reject(error);
            this.activeRequest = null;
        }
        const queued = this.queue.splice(0);
        queued.forEach((request) => request.reject(error));
    }
}
