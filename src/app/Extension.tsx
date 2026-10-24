import React from 'react';
import type {ExtensionProps, FlyoutProps} from '../argocd/types';
import type {GatewayContext} from '../argocd/gateway-context';
import {SwaggerCatalog} from '../features/swagger/SwaggerCatalog';
import '../styles/extension.css';
export function Extension(props: ExtensionProps) {
  void props;
  return <span>Swagger</span>;
}
export function ExtensionFlyout({context, basePath = '/'}: FlyoutProps & {readonly context?: GatewayContext; readonly basePath?: string}) {
  return <section id="argocd-ext-swagger-gateway" aria-label="Swagger Gateway">
    <header className="swagger-heading"><h1>Swagger Gateway</h1><p>Explore a documentação das APIs publicadas.</p></header>
    {context ? <SwaggerCatalog context={context} basePath={basePath} /> : <p role="status">Abra a Application swagger-gateway do projeto appset para consultar as APIs.</p>}
  </section>;
}
