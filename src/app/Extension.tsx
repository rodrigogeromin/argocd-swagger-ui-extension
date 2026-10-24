import React from 'react';
import type {GatewayContext} from '../argocd/gateway-context';
import {SwaggerCatalog} from '../features/swagger/SwaggerCatalog';
import '../styles/extension.css';

export function Extension({context, basePath}: {readonly context: GatewayContext; readonly basePath: string}) {
  return <section id="argocd-ext-swagger-gateway" aria-label="Swagger Gateway">
    <header className="swagger-heading"><h1>Swagger Gateway</h1><p>Explore a documentação das APIs publicadas.</p></header>
    <SwaggerCatalog context={context} basePath={basePath} />
  </section>;
}
