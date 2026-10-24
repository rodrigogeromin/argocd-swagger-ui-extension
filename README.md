# Argo CD Swagger UI Extension

Ação **Swagger** na barra da Application `swagger-gateway`, com catálogo das publicações OpenAPI e documentação no flyout do Argo CD. Implementada em React/TypeScript com a skill `argocd-ui-extension`, alvo exato **Argo CD 3.5.1**, perfil `top-bar-action`.

O botão e o ícone pertencem ao Argo CD. A extensão consulta o Swagger Gateway pelo proxy `/extensions/swagger`, usando a sessão do usuário e os headers de contexto. Não contém credenciais e não acessa DNS Kubernetes pelo navegador.

## Comportamento

1. Abra a Application `argocd/swagger-gateway`, projeto `appset`.
2. Clique em **Swagger** na barra de ações.
3. Selecione a publicação Go ou Java. O HTML universal do gateway é carregado no flyout, via `fetch` autenticado e `iframe.srcdoc`.
4. Use **Atualizar catálogo** para recarregar. Falhas de sessão, permissão, catálogo inválido e indisponibilidade têm mensagens próprias.

A visibilidade está restrita ao contexto autorizado pela PoC. O contexto ausente tem fallback, e requisições são canceladas ao fechar, atualizar ou trocar a seleção. URLs respeitam o `<base href>` do Argo CD, incluindo instalações sob `/argocd/`.

## Desenvolvimento e verificação

Requer Node **26.10.0** e npm **11.19.1** (também fixados no CI).

```sh
npm run runtime:setup
npm ci
npm run dev
```

O preview em `http://127.0.0.1:8080` usa exclusivamente mocks locais do gateway. Clique em Swagger para abrir o flyout. Cenários:

- `?fixture=empty`: catálogo vazio.
- `?fixture=denied`: acesso negado.
- `?fixture=error`: gateway indisponível.
- `?fixture=absent`: contexto ausente, ação oculta.
- `?theme=dark&width=390px&height=844px`: viewport estreito e tema escuro.

A CDN do Swagger UI precisa estar acessível para a documentação renderizar no preview. Mocks nunca entram no bundle de produção.

```sh
npm run validate
npm run evidence:check
npm audit --audit-level=moderate
```

A validação executa tipos, lint, testes de domínio, build, inspeção do bundle, empacotamento e harness do JavaScript de produção. O harness modela os globals do host, o botão com ícone, o flyout e a troca de publicação. O relatório `validation-report.json` vincula os hashes das fontes, bundle e pacote. `npm run evidence:check` recusa evidências obsoletas.

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

A instalação exige que o JavaScript esteja sob `/tmp/extensions/` em **todos** os pods `argocd-server`. O patch estratégico da release acrescenta o init container exclusivo do Swagger, com imagem fixada por digest, checksum habilitado e volume `/tmp` compartilhado. Preserve outras extensões e adapte volumes existentes e a fonte Helm/GitOps antes de aplicar. Depois da instalação, recarregue a interface e verifique a ação Swagger na Application da PoC. Gateway, proxy e RBAC continuam separados.

**Este repositório não instala a UI no cluster nem declara integração real comprovada.** O backend da PoC é independente. A instalação e a validação visual no Argo CD 3.5.1 são uma etapa separada; os checks locais e o CI mantêm `integration: not-run`.

## Pré-requisitos do gateway

O gateway deve implementar `GET /api/v1/catalog`, `GET /ui/{id}` e `GET /specs/{id}` com o contrato da PoC, sob o único Proxy Extension `swagger`. A Application autorizada é `argocd:swagger-gateway`, projeto `appset`; o catálogo retorna `application`, `project`, `namespace`, `id`, `title`, `uiUrl` e `specUrl`. IDs são simples e URLs públicas são relativas sob `/extensions/swagger`.

Os merge patches em `config/` documentam a configuração já usada pela PoC e preservam chaves não relacionadas:

```sh
kubectl patch configmap argocd-cm -n argocd --type merge --patch-file config/argocd-proxy.patch.yaml
kubectl patch configmap argocd-cmd-params-cm -n argocd --type merge --patch-file config/argocd-params.patch.yaml
kubectl patch configmap argocd-rbac-cm -n argocd --type merge --patch-file config/argocd-rbac.patch.yaml
```

Reinicie `argocd-server` se estiver habilitando pela primeira vez o feature flag do proxy. Não é necessário reinstalar ou reconfigurar o backend ao alternar publicações.

A regra RBAC de exemplo autoriza `role:admin` a invocar somente `swagger`. Outros usuários precisam de permissões específicas de Application e extensão. A validação de contexto no frontend não substitui a autorização server-side.

## Limites da PoC

- Catálogo estático de duas demonstrações; sem discovery, autorização por tenant ou suporte multicluster.
- O HTML do gateway é código confiável executado em `srcdoc` na origem do Argo CD. Nunca inclua HTML arbitrário de upstreams nesse fluxo. Assets Swagger UI usam a CDN versionada do gateway; a CSP do ambiente deve permitir os recursos necessários.
- O HTML atual do gateway configura headers fixos para a Application da PoC. Para ampliar o catálogo, evolua o contrato e a autorização do backend antes de ampliar a visibilidade da extensão.
- Try it out permanece desabilitado. A extensão não cria um proxy de execução de chamadas.
- Somente **3.5.1** foi auditada para este projeto. Builds/harness simulados não comprovam renderização no host e não ampliam a matriz de compatibilidade integrada.

## Fontes oficiais auditadas

- [Serviço e assinaturas de extensões](https://github.com/argoproj/argo-cd/blob/v3.5.1/ui/src/app/shared/services/extensions-service.ts)
- [Bootstrap e globals](https://github.com/argoproj/argo-cd/blob/v3.5.1/ui/src/app/index.tsx)
- [Manifesto UI](https://github.com/argoproj/argo-cd/blob/v3.5.1/ui/package.json) e [lockfile real](https://github.com/argoproj/argo-cd/blob/v3.5.1/ui/pnpm-lock.yaml)
- [Consumer da ação e flyout](https://github.com/argoproj/argo-cd/blob/v3.5.1/ui/src/app/applications/components/application-details/application-details.tsx)
