import type {Application} from './types';

export interface GatewayContext {
  readonly application: string;
  readonly project: string;
}

export function gatewayContext(application?: Application): GatewayContext | undefined {
  if (application?.metadata?.name !== 'swagger-gateway' ||
      application.metadata.namespace !== 'argocd' || application.spec?.project !== 'appset') return undefined;
  return {application: `${application.metadata.namespace}:${application.metadata.name}`, project: application.spec.project};
}

export function argoBasePath(): string {
  const base = new URL(document.querySelector('base')?.getAttribute('href') || '/', window.location.origin);
  if (base.origin !== window.location.origin || base.search || base.hash) throw new Error('Configuração de base URL do Argo CD inválida.');
  return base.pathname.replace(/\/?$/, '/');
}
