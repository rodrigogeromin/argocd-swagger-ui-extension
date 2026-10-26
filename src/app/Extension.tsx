import React from 'react';
import type {GatewayContext} from '../argocd/gateway-context';
import {SwaggerCatalog} from '../features/swagger/SwaggerCatalog';
import '../styles/extension.css';

export function Extension({context, configError, basePath}: {readonly context?: GatewayContext; readonly configError?: string; readonly basePath: string}) {
  return <section id="argocd-ext-swagger-gateway" aria-label="Swagger Gateway">
    <header className="swagger-heading"><h1>Swagger Gateway</h1><p>Explore a documentação das APIs publicadas.</p></header>
    {context ? <SwaggerCatalog context={context} basePath={basePath} /> : <p role="alert">{configError || 'Configuração Swagger Gateway inválida. Configure application e project no ConfigMap swagger-gateway-config.'}</p>}
  </section>;
}
