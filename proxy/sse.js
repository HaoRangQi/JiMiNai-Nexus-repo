export class DeltaTracker {
    constructor() {
        this.lastText = '';
    }

    next(fullText) {
        const current = String(fullText || '');
        let delta = current;
        if (current.startsWith(this.lastText)) {
            delta = current.slice(this.lastText.length);
        }
        this.lastText = current;
        return delta;
    }
}

export function setupSse(response) {
    response.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });
}

export function writeSse(response, payload, eventName = null) {
    if (eventName) {
        if (String(eventName).includes('\n')) throw new Error('Invalid SSE event name.');
        response.write(`event: ${eventName}\n`);
    }
    response.write(`data: ${typeof payload === 'string' ? payload : JSON.stringify(payload)}\n\n`);
}

export function writeDone(response) {
    writeSse(response, '[DONE]');
    response.end();
}
