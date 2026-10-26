import type {Publication} from '../src/features/swagger/client';
export const context = {application: 'argocd:swagger-gateway', project: 'appset'};
export const publications: Publication[] = ['go-demo', 'java-demo'].map((id, index) => ({
  id, title: index ? 'Java demo' : 'Go demo', application: index ? 'payments-api' : 'orders-api', project: index ? 'payments' : 'commerce', namespace: 'demo',
  uiUrl: `/extensions/swagger/ui/${id}`, specUrl: `/extensions/swagger/specs/${id}`
}));
export function response(body: unknown, status = 200, contentType = 'application/json'): Response {
  return {ok: status >= 200 && status < 300, status, headers: {get: () => contentType}, text: async () => typeof body === 'string' ? body : JSON.stringify(body)} as unknown as Response;
}
export function html(id: string) { return `<!doctype html><html><body><h1>${id}</h1><script>const url='/extensions/swagger/specs/${id}';</script></body></html>`; }
export function gatewayFetch() {
  return jest.fn(async (url: string) => response(url.endsWith('/api/v1/catalog') ? {items: publications} : html(url.split('/').pop()!), 200, url.includes('/ui/') ? 'text/html' : 'application/json'));
}
