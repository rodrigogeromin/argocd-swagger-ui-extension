export interface GatewayContext {
  readonly application: string;
  readonly project: string;
}

declare global {
  interface Window {
    swaggerGatewayConfig?: unknown;
  }
}

export function readGatewayContext(config: unknown = window.swaggerGatewayConfig): GatewayContext {
  if (!config || typeof config !== 'object') {
    throw new Error('Swagger Gateway não configurado. Configure application e project no ConfigMap swagger-gateway-config e reinicie o argocd-server.');
  }
  const values = config as Record<string, unknown>;
  const application = typeof values.application === 'string' ? values.application.trim() : '';
  const [namespace, applicationName, ...extraSegments] = application.split(':');
  if (!namespace?.trim() || !applicationName?.trim() || extraSegments.length > 0 ||
      typeof values.project !== 'string' || !values.project.trim()) {
    throw new Error('Configuração Swagger Gateway inválida. Defina application no formato namespace:name e project não vazios no ConfigMap swagger-gateway-config e reinicie o argocd-server.');
  }
  return Object.freeze({application, project: values.project.trim()});
}

export function argoBasePath(): string {
  const base = new URL(document.querySelector('base')?.getAttribute('href') || '/', window.location.origin);
  if (base.origin !== window.location.origin || base.search || base.hash) throw new Error('Configuração de base URL do Argo CD inválida.');
  return base.pathname.replace(/\/?$/, '/');
}
