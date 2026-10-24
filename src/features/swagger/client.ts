import type {GatewayContext} from '../../argocd/gateway-context';

export interface Publication {
  readonly id: string;
  readonly title: string;
  readonly application: string;
  readonly project: string;
  readonly namespace: string;
  readonly specUrl: string;
  readonly uiUrl: string;
}

export class GatewayError extends Error {}

export function publicUrl(path: string, basePath: string): string {
  if (!/^\/extensions\/swagger\/(api\/v1\/catalog|(?:ui|specs)\/[a-z0-9-]{1,64})$/.test(path)) {
    throw new GatewayError('O gateway devolveu uma URL de publicação inválida.');
  }
  return `${basePath}${path.slice(1)}`;
}

async function get(path: string, context: GatewayContext, signal: AbortSignal, basePath: string): Promise<{body: string; contentType: string}> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal.aborted) cancel();
  signal.addEventListener('abort', cancel, {once: true});
  const timer = window.setTimeout(cancel, 15000);
  try {
    const response = await fetch(publicUrl(path, basePath), {
      credentials: 'same-origin', redirect: 'error', signal: controller.signal,
      headers: {'Argocd-Application-Name': context.application, 'Argocd-Project-Name': context.project}
    });
    if (!response.ok) {
      if (response.status === 400) throw new GatewayError('Não foi possível autorizar a consulta. Confira sua sessão e o contexto da Application.');
      if ([401, 403].includes(response.status)) throw new GatewayError('Sem permissão para acessar o Swagger Gateway. Verifique sua sessão e o RBAC.');
      if (response.status === 404) throw new GatewayError('Publicação ou proxy Swagger não encontrado.');
      throw new GatewayError('O Swagger Gateway está indisponível. Tente novamente.');
    }
    return {body: await response.text(), contentType: response.headers.get('Content-Type') || ''};
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof GatewayError) throw error;
    throw new GatewayError(controller.signal.aborted ? 'O Swagger Gateway demorou para responder. Tente novamente.' : 'Não foi possível conectar ao Swagger Gateway.');
  } finally {
    window.clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}

export async function loadCatalog(context: GatewayContext, signal: AbortSignal, basePath = '/'): Promise<readonly Publication[]> {
  const response = await get('/extensions/swagger/api/v1/catalog', context, signal, basePath);
  let body: unknown;
  try { body = JSON.parse(response.body); } catch { throw new GatewayError('O catálogo recebido é inválido.'); }
  if (!body || typeof body !== 'object' || !('items' in body) || !Array.isArray(body.items)) throw new GatewayError('O catálogo recebido é inválido.');
  const ids = new Set<string>();
  return body.items.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new GatewayError('Publicação inválida no catálogo.');
    const value = item as Record<string, unknown>;
    const fields = ['id', 'title', 'application', 'project', 'namespace', 'specUrl', 'uiUrl'];
    if (fields.some(key => typeof value[key] !== 'string' || !value[key])) throw new GatewayError('Publicação inválida no catálogo.');
    const publication = value as unknown as Publication;
    if (!/^[a-z0-9-]{1,64}$/.test(publication.id) || ids.has(publication.id) ||
        publication.uiUrl !== `/extensions/swagger/ui/${publication.id}` ||
        publication.specUrl !== `/extensions/swagger/specs/${publication.id}` ||
        publication.application !== context.application.split(':')[1] || publication.project !== context.project) {
      throw new GatewayError('Publicação fora do contexto autorizado ou com URLs inválidas.');
    }
    ids.add(publication.id);
    return publication;
  });
}

export async function loadDocumentation(publication: Publication, context: GatewayContext, signal: AbortSignal, basePath = '/'): Promise<string> {
  const response = await get(publication.uiUrl, context, signal, basePath);
  if (!response.contentType.includes('text/html')) throw new GatewayError('O gateway não devolveu uma página de documentação válida.');
  // Only trusted gateway HTML is embedded; upstream HTML is never loaded.
  return response.body.replaceAll('/extensions/swagger/', `${basePath}extensions/swagger/`);
}
