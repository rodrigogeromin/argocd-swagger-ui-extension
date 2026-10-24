export interface GatewayContext {
  readonly application: string;
  readonly project: string;
}

// Explicit PoC routing context, independent of host Application selection.
// The backend still authorizes the user's session and RBAC for every request.
export const gatewayContext: GatewayContext = Object.freeze({
  application: 'argocd:swagger-gateway',
  project: 'appset'
});

export function argoBasePath(): string {
  const base = new URL(document.querySelector('base')?.getAttribute('href') || '/', window.location.origin);
  if (base.origin !== window.location.origin || base.search || base.hash) throw new Error('Configuração de base URL do Argo CD inválida.');
  return base.pathname.replace(/\/?$/, '/');
}
