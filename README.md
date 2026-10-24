# Argo CD Swagger UI Extension

Página **Swagger** no menu lateral, rota `/swagger`, com catálogo das publicações OpenAPI e documentação em página completa, sem selecionar Application. Implementada em React/TypeScript com a skill `argocd-ui-extension`, alvo exato **Argo CD 3.5.1**, perfil `system-level`.

O menu lateral, a rota e o ícone pertencem ao Argo CD. A extensão consulta o Swagger Gateway pelo proxy `/extensions/swagger`, usando a sessão do usuário e os headers de contexto. Não contém credenciais e não acessa DNS Kubernetes pelo navegador.

## Comportamento

1. Abra **Swagger** no menu lateral (`/swagger`).
2. Selecione a publicação Go ou Java. O HTML universal do gateway é carregado na página, via `fetch` autenticado e `iframe.srcdoc`.
3. Use **Atualizar catálogo** para recarregar. Falhas de sessão, permissão, catálogo inválido e indisponibilidade têm mensagens próprias.

O adapter fornece explicitamente o contexto fixo `argocd:swagger-gateway` / `appset`, sem depender de Application selecionada. O menu aparece sem contexto de Application; a sessão e o RBAC do backend autorizam as requisições. Requisições são canceladas ao sair da página, atualizar ou trocar a seleção. URLs respeitam o `<base href>` do Argo CD, incluindo instalações sob `/argocd/`.

## Desenvolvimento e verificação

Requer Node **26.10.0** e npm **11.19.1** (também fixados no CI).

```sh
npm run runtime:setup
npm ci
npm run dev
```

O preview em `http://127.0.0.1:8080` usa exclusivamente mocks locais do gateway. O menu lateral Swagger apresenta a página completa. Cenários:

- `?fixture=empty`: catálogo vazio.
- `?fixture=denied`: acesso negado.
- `?fixture=error`: gateway indisponível.
- `?fixture=absent`: página sem Application selecionada; usa o contexto explícito da PoC.
- `?theme=dark&width=390px&height=844px`: viewport estreito e tema escuro.

A CDN do Swagger UI precisa estar acessível para a documentação renderizar no preview. Mocks nunca entram no bundle de produção.

```sh
npm run validate
npm run evidence:check
npm audit --audit-level=moderate
```

A validação executa tipos, lint, testes de domínio, build, inspeção do bundle, empacotamento e harness do JavaScript de produção. O harness modela os globals do host, o menu lateral, a página sem props e a troca de publicação. O relatório `validation-report.json` vincula os hashes das fontes, bundle e pacote. `npm run evidence:check` recusa evidências obsoletas.

A configuração do projeto é schema v2, template de origem 2.2.1. `references/host-audit.json` registra a inspeção das fontes oficiais da release exata; `extension-project.json` e `references/host-contract.json` registram o contrato executável. React/DOM **19.2.6**, tipos **19.2.14/19.2.3**, JSX automático: runtime externo fornecido pelo host, sem React embutido.

## Artefato e instalação

O build gera um único JavaScript:

```text
dist/resources/extension-swagger-gateway.js
dist/swagger-gateway.tar.gz
```

O tar contém apenas `resources/extension-swagger-gateway.js`, adequado ao fluxo de instalação de extensões do Argo CD. O workflow `validate.yml` publica pacote e relatório como artifacts da execução. Para download:

```sh
gh run list --repo rodrigogeromin/argocd-swagger-ui-extension
gh run download RUN_ID --repo rodrigogeromin/argocd-swagger-ui-extension \
  --name swagger-gateway-extension --dir artifacts
```

O workflow `release.yml` publica por tag `v` + `package.json.version`, após validar a identidade, executar `validate` e conferir as evidências. Anexa `swagger-gateway.tar.gz`, `checksums.txt`, `argocd-server-patch.yaml`, `validation-report.json` e `installation.md`. Atualize a versão e o lockfile, valide e envie o commit antes de criar/enviar a tag correspondente. O [manual de publicação e instalação](docs/installation.md) contém os comandos e a revisão necessária do patch.

A instalação exige que o JavaScript esteja sob `/tmp/extensions/` em **todos** os pods `argocd-server`. O patch estratégico da release acrescenta o init container exclusivo do Swagger, com imagem fixada por digest, checksum habilitado e volume `/tmp` compartilhado. Preserve outras extensões e adapte volumes existentes e a fonte Helm/GitOps antes de aplicar. Depois da instalação, recarregue a interface e abra Swagger no menu lateral, rota `/swagger`, sem selecionar Application. Gateway, proxy e RBAC continuam separados.

A release **v0.2.0** (system-level) foi publicada e instalada no Argo CD 3.5.1 do contexto `k3d-dev`. O rollout concluiu com 1/1 Ready; hash no pod, bundle exato servido, ausência do antigo bundle Top Bar do Swagger e catálogo/specs autenticados foram conferidos. Outras extensões foram preservadas. Veja as [evidências v0.2.0](docs/evidence/installation-v0.2.0-k3d-dev.json).

Registro histórico: a release **v0.1.0 foi instalada persistentemente no Argo CD 3.5.1 do contexto k3d-dev**, por init container no Deployment. Rollout, checksum no pod, bundle exato servido e catálogo/specs pelo proxy autenticado foram verificados; outras extensões foram preservadas. Consulte as [evidências de instalação](docs/evidence/installation-v0.1.0-k3d-dev.json).

**Validação visual pendente:** não havia navegador disponível na sessão de instalação. Na instalação histórica v0.1.0, registro efetivo no browser, visibilidade da ação, abertura/fechamento do flyout e renderização do iframe não foram observados. Na v0.2.0, o bundle instalado foi conferido; renderização do menu lateral, navegação e interação do iframe ainda aguardam teste real no browser. A matriz de integração continua vazia e os checks locais/CI mantêm `integration: not-run`. O backend da PoC permanece independente; outros ambientes exigem instalação conforme o manual.

## Pré-requisitos do gateway

O gateway deve implementar `GET /api/v1/catalog`, `GET /ui/{id}` e `GET /specs/{id}` com o contrato da PoC, sob o único Proxy Extension `swagger`. A Application autorizada é `argocd:swagger-gateway`, projeto `appset`; o catálogo retorna `application`, `project`, `namespace`, `id`, `title`, `uiUrl` e `specUrl`. IDs são simples e URLs públicas são relativas sob `/extensions/swagger`.

Os merge patches em `config/` documentam a configuração já usada pela PoC e preservam chaves não relacionadas:

```sh
kubectl patch configmap argocd-cm -n argocd --type merge --patch-file config/argocd-proxy.patch.yaml
kubectl patch configmap argocd-cmd-params-cm -n argocd --type merge --patch-file config/argocd-params.patch.yaml
kubectl patch configmap argocd-rbac-cm -n argocd --type merge --patch-file config/argocd-rbac.patch.yaml
```

Reinicie `argocd-server` se estiver habilitando pela primeira vez o feature flag do proxy. Não é necessário reinstalar ou reconfigurar o backend ao alternar publicações.

A regra RBAC de exemplo autoriza `role:admin` a invocar somente `swagger`. Outros usuários precisam de permissões específicas de Application e extensão. O contexto fixo no frontend não substitui a autorização server-side.

## Limites da PoC

- Catálogo estático de duas demonstrações; sem discovery, autorização por tenant ou suporte multicluster.
- O HTML do gateway é código confiável executado em `srcdoc` na origem do Argo CD. Nunca inclua HTML arbitrário de upstreams nesse fluxo. Assets Swagger UI usam a CDN versionada do gateway; a CSP do ambiente deve permitir os recursos necessários.
- O HTML atual do gateway configura headers fixos para a Application da PoC. Para ampliar o catálogo, evolua o contrato e a autorização do backend antes de ampliar o catálogo da extensão.
- Try it out permanece desabilitado. A extensão não cria um proxy de execução de chamadas.
- Somente **3.5.1** foi auditada para este projeto. Builds/harness simulados não comprovam renderização no host e não ampliam a matriz de compatibilidade integrada.

## Fontes oficiais auditadas

- [Serviço e assinaturas de extensões](https://github.com/argoproj/argo-cd/blob/v3.5.1/ui/src/app/shared/services/extensions-service.ts)
- [Bootstrap e globals](https://github.com/argoproj/argo-cd/blob/v3.5.1/ui/src/app/index.tsx)
- [Manifesto UI](https://github.com/argoproj/argo-cd/blob/v3.5.1/ui/package.json) e [lockfile real](https://github.com/argoproj/argo-cd/blob/v3.5.1/ui/pnpm-lock.yaml)
- [Consumer do menu e página system-level](https://github.com/argoproj/argo-cd/blob/v3.5.1/ui/src/app/app.tsx)
