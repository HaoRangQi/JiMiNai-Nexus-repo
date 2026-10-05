import { ProxyError } from './errors.js';

export const DEFAULT_API_MODEL = 'gemini-web-3.5-flash';

export const API_MODELS = Object.freeze([
    Object.freeze({
        id: 'gemini-web-3.5-flash',
        label: 'Gemini Web 3.5 Flash',
        webModel: '56fdd199312815e2',
    }),
    Object.freeze({
        id: 'gemini-web-3.1-flash-lite',
        label: 'Gemini Web 3.1 Flash-Lite',
        webModel: '8c46e95b1a07cecc',
    }),
    Object.freeze({
        id: 'gemini-web-3.1-pro',
        label: 'Gemini Web 3.1 Pro',
        webModel: 'e6fa609c3fa255c0',
    }),
]);

const MODEL_ALIASES = Object.freeze({
    'gemini-web-3.5-flash': '56fdd199312815e2',
    'gemini-web-3.1-flash-lite': '8c46e95b1a07cecc',
    'gemini-web-3.1-pro': 'e6fa609c3fa255c0',
    'gemini-2.5-flash': '8c46e95b1a07cecc',
    'gemini-3.1-flash-lite': '8c46e95b1a07cecc',
    'gemini-3-flash': '8c46e95b1a07cecc',
    'gemini-3.5-flash': '56fdd199312815e2',
    'gemini-3-flash-thinking': '56fdd199312815e2',
    'gemini-3.1-pro': 'e6fa609c3fa255c0',
    'gemini-3-pro': 'e6fa609c3fa255c0',
});

const SUPPORTED_WEB_MODELS = new Set(API_MODELS.map((model) => model.webModel));

export function normalizeProxyModel(model) {
    const requested = String(model || DEFAULT_API_MODEL).trim();
    const normalized = MODEL_ALIASES[requested] || requested;
    if (!SUPPORTED_WEB_MODELS.has(normalized)) {
        throw new ProxyError(400, `Unsupported model: ${requested}`);
    }
    return normalized;
}

export function createOpenAIModelList() {
    return {
        object: 'list',
        data: API_MODELS.map((model) => ({
            id: model.id,
            object: 'model',
            created: 0,
            owned_by: 'gemini-nexus',
        })),
    };
}
