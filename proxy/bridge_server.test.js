import { describe, expect, it } from 'vitest';
import { BridgeServer } from './bridge_server.js';

describe('BridgeServer', () => {
    it('rejects requests when the extension bridge is disconnected', async () => {
        const bridge = new BridgeServer();

        await expect(bridge.sendRequest({ prompt: 'hello' })).rejects.toMatchObject({
            status: 503,
        });
    });

    it('notifies an existing bridge when a replacement connects', () => {
        const bridge = new BridgeServer();
        const sent = [];
        const closed = [];
        const oldSocket = {
            readyState: 1,
            send: (message) => sent.push(JSON.parse(message)),
            close: () => closed.push(true),
        };
        const newSocket = {
            readyState: 1,
            on: () => {},
        };
        bridge.socket = oldSocket;

        bridge.handleConnection(newSocket);

        expect(sent).toEqual([{ type: 'replaced' }]);
        expect(closed).toHaveLength(1);
    });

    it('preflights queue overflow before streaming responses are opened', () => {
        const bridge = new BridgeServer({ queueLimit: 1 });
        bridge.socket = { readyState: 1 };
        bridge.activeRequest = { id: 'active' };
        bridge.queue = [{ id: 'queued' }];

        expect(() => bridge.assertCanAcceptRequest()).toThrow('API bridge request queue is full');
    });
});
