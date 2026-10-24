// Browser-only fixture transport; never imported by the production entrypoint.
export function installPreviewGateway() {
  const realFetch = window.fetch.bind(window);
  const mode = new URLSearchParams(window.location.search).get('fixture');
  const items = ['go-demo', 'java-demo'].map(id => ({id, title: id === 'go-demo' ? 'Go demo' : 'Java demo',
    application: 'swagger-gateway', project: 'appset', namespace: 'swagger-gateway',
    uiUrl: `/extensions/swagger/ui/${id}`, specUrl: `/extensions/swagger/specs/${id}`}));
  window.fetch = async (input, options) => {
    const path = String(input);
    if (!path.includes('/extensions/swagger/')) return realFetch(input, options);
    if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (mode === 'denied') return new Response('Forbidden', {status: 403});
    if (mode === 'error') return new Response('Unavailable', {status: 502});
    if (path.endsWith('/api/v1/catalog')) return Response.json({items: mode === 'empty' ? [] : items});
    if (path.includes('/ui/')) {
      const id = path.split('/').pop()!;
      const title = id === 'go-demo' ? 'Go demonstration API' : 'Java demonstration API';
      const doc = {openapi:'3.0.3',info:{title,version:'1.0.0'},paths:{'/hello':{get:{summary:'Example greeting',responses:{'200':{description:'Greeting'}}}}}};
      return new Response(`<!doctype html><html><head><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({spec:${JSON.stringify(doc)},dom_id:'#swagger-ui',supportedSubmitMethods:[],validatorUrl:null});</script></body></html>`, {headers:{'Content-Type':'text/html'}});
    }
    return new Response('Not found', {status:404});
  };
}
