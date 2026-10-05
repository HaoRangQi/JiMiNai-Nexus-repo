export class ProxyError extends Error {
    constructor(status, message) {
        super(message);
        this.name = 'ProxyError';
        this.status = status;
    }
}

export function toProxyError(error, fallbackStatus = 500) {
    if (error instanceof ProxyError) return error;
    return new ProxyError(fallbackStatus, error?.message || 'Proxy request failed.');
}
