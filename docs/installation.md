# Publicação e instalação da Swagger UI Extension

Alvo auditado: Argo CD **3.5.1**. O pacote instala somente o JavaScript da UI; gateway, proxy e RBAC são pré-requisitos separados. Checks locais e CI mantêm `integration.status: not-run` e não comprovam instalação ou validação visual no cluster.

A versão **v0.2.1** corrige a corrida de inicialização da página system-level `/swagger`: aguarda o primeiro commit em `#app` antes de emitir o registro, ou registra imediatamente se o host já estiver montado. O React 19 agenda a renderização; na v0.2.0 o evento podia anteceder a inscrição do App e perder menu e rota. Use o patch da release conforme este manual. O init container e o nome do JavaScript permanecem iguais, substituindo a UI anterior sem duplicar a extensão.

## Publicar uma release

Use Node 26.10.0 (`.nvmrc`) e npm 11.19.1. Atualize `package.json.version` e o lockfile com `npm version VERSAO --no-git-tag-version`, execute os checks e envie o commit revisado antes de criar a tag:

```sh
npm ci
npm run validate
npm run evidence:check
# Após commit e push da alteração de versão:
git tag vVERSAO
git push origin vVERSAO
```

Substitua `VERSAO` pela mesma versão SemVer em todos os comandos. O workflow `release.yml` dispara somente para tags `v*`, rejeita identidade incompatível antes de `npm ci`, valida e confere evidências antes de publicar. O CI de main continua em `validate.yml`. A publicação usa a tag existente (`--verify-tag`), notas geradas e estes cinco assets:

- `swagger-gateway.tar.gz`: somente `resources/extension-swagger-gateway.js`.
- `checksums.txt`: SHA-256 do pacote real, no formato aceito pelo instalador.
- `argocd-server-patch.yaml`: patch com URLs do repositório e tag dessa release.
- `swagger-gateway-config.yaml`: exemplo de ConfigMap com Application e Project configuráveis.
- `validation-report.json`: evidências locais e harness, sem certificação de integração.
- `installation.md`: este manual.

Para conferir o preparo local, após o build:

```sh
RELEASE_TAG=v0.2.1 RELEASE_REPOSITORY=rodrigogeromin/argocd-swagger-ui-extension node scripts/release-assets.mjs
(cd dist && sha256sum --check checksums.txt)
```

Use a versão corrente do `package.json`. `--validate-only` confere identidade sem exigir pacote. `deploy/argocd-server-patch.yaml` é um template; instale a cópia gerada/anexada à release. Nenhuma release ou instalação é executada por estes exemplos até o operador rodar os comandos.

## Revisar e instalar

O patch assume Deployment `argocd/argocd-server`, container `argocd-server` e volume `tmp` do tipo `emptyDir`, compartilhado em `/tmp`. O init container exclusivo `argocd-extension-installer-swagger-gateway` usa a imagem oficial v1.1.0 fixada por digest, verifica `EXTENSION_CHECKSUM_URL` e instala em `/tmp/extensions/resources`. Os pods precisam alcançar GitHub para baixar assets e Quay para obter a imagem. A configuração de proxy é um ConfigMap separado e deve ser criado antes do patch.

Edite `deploy/swagger-gateway-config.yaml` (ou `release-v0.2.1/swagger-gateway-config.yaml` ao instalar a partir da release baixada) para definir `application` no formato `namespace:name` e o `project` existente que o proxy deve usar. A extensão carrega esse JavaScript antes do bundle e mantém os valores imutáveis durante a renderização. Applications e Projects nos metadados das publicações podem ser diferentes. A ausência de configuração mostra uma mensagem de setup e não envia requisições.

```sh
kubectl apply -f deploy/swagger-gateway-config.yaml
# Ao instalar a partir dos assets baixados, use no lugar da linha acima:
# kubectl apply -f release-v0.2.1/swagger-gateway-config.yaml
```

Após alterar o ConfigMap, reinicie `argocd-server` para que os pods montem a configuração atualizada e regenerem `/extensions.js`.

Baixe uma tag específica e confira o checksum antes de revisar/aplicar:

```sh
gh release download v0.2.1 --repo rodrigogeromin/argocd-swagger-ui-extension \
  --pattern swagger-gateway.tar.gz --pattern checksums.txt \
  --pattern argocd-server-patch.yaml --pattern swagger-gateway-config.yaml --pattern validation-report.json \
  --pattern installation.md --dir release-v0.2.1
(cd release-v0.2.1 && sha256sum --check checksums.txt)
kubectl get deployment argocd-server -n argocd -o yaml > argocd-server-before.yaml
# Revise o patch e adapte a fonte de configuração do ambiente antes de aplicar.
kubectl patch deployment argocd-server -n argocd --type strategic \
  --patch-file release-v0.2.1/argocd-server-patch.yaml --dry-run=server -o yaml
kubectl patch deployment argocd-server -n argocd --type strategic \
  --patch-file release-v0.2.1/argocd-server-patch.yaml
kubectl rollout status deployment/argocd-server -n argocd
```

O merge estratégico preserva containers, init containers e volumes de outros nomes. Se `/tmp` já usa um volume com outro nome, altere o nome do volume no mount do instalador para reutilizá-lo e remova a definição adicional de `tmp` do patch; mantenha o mount existente do servidor. Revise também colisões de nomes, tipo do volume, permissões para UID 1000 e políticas do cluster. Não substitua listas inteiras nem remova extensões existentes. O arquivo instalado tem nome próprio `extension-swagger-gateway.js`.

Em instalações gerenciadas por Helm ou GitOps, registre o init container e o volume compartilhado nos values/manifests da fonte de verdade e faça a reconciliação por esse fluxo. Um patch manual pode ser revertido pelo controlador. Não aplique o exemplo sem adaptar namespace, Deployment, container e volume ao ambiente.

Após rollout, confira os logs do init container e o arquivo em todos os pods do servidor; recarregue o navegador e abra Swagger no menu lateral, rota `/swagger`, sem selecionar Application e teste seleção/atualização das publicações e falhas de autorização. Esse teste real deve ser registrado separadamente; não transforme evidência local em comprovação de integração.

## Gateway, proxy, RBAC e segurança

O gateway precisa servir catálogo, HTML e specs pelo Proxy Extension `swagger`, com contexto de Application e permissões server-side. Consulte o [README](../README.md#pré-requisitos-do-gateway) e os patches em `config/` no repositório da tag. Instalar a UI não habilita o proxy, não implanta backend e não concede RBAC.

O HTML confiável do gateway roda em `iframe.srcdoc` na origem do Argo CD. Não aceite HTML arbitrário de upstreams. A CSP deve permitir os recursos da CDN versionada usados pelo gateway; revise as diretivas necessárias segundo a política do ambiente, sem desabilitar a CSP globalmente. Try it out permanece desabilitado. Não inclua credenciais no bundle ou no patch. O ConfigMap define o contexto do proxy, e o gateway continua responsável pela autorização de cada sessão.

## Teste de configuração em `k3d-argocd-lab`

A configuração runtime foi montada no Deployment local junto com o bundle final do build. O ConfigMap foi trocado temporariamente para `argocd:swagger-petstore` / `appset`, Application existente no cluster; rollouts passaram, o pod recebeu o bundle com o hash local e `/extensions.js` serviu o script de configuração antes do bundle. O harness de produção confirmou os headers `Argocd-Application-Name: argocd:swagger-petstore` e `Argocd-Project-Name: appset`. Depois do teste, o ConfigMap voltou para `argocd:swagger-gateway` / `appset` e o rollout passou.

Esse cluster executa Argo CD **3.5.6**, enquanto o contrato de host deste projeto foi auditado para **3.5.1**. A verificação autenticada no navegador não foi executada e a matriz de compatibilidade integrada permanece vazia. O Deployment local mantém o bundle de teste montado por ConfigMap. Consulte o [registro de runtime config](evidence/runtime-config-k3d-argocd-lab.json).

## Instalação observada (v0.2.1)

A correção foi publicada e instalada no Argo CD 3.5.1, contexto `k3d-dev`. Rollout 1/1 Ready, checksum do instalador, hash no pod e bundle exato servido foram conferidos. O bundle v0.2.0 foi substituído, preservando os outros instaladores. Catálogo, HTML e specs Go/Java responderam pelo proxy autenticado.

O teste de regressão falhou com o bundle anterior e passou após a correção, nos cenários de host ainda vazio e já montado. A execução do JavaScript completo servido foi conferida em jsdom: Swagger aguardou a montagem e registrou uma única vez. Isso não comprova renderização no navegador real, indisponível na sessão. Após atualizar a interface, abra Swagger no menu lateral, rota `/swagger`. [Evidências e hashes](evidence/installation-v0.2.1-k3d-dev.json).

## Instalação observada (v0.2.0)

A release system-level v0.2.0 foi publicada e instalada no contexto `k3d-dev`, Argo CD 3.5.1. O mesmo init container e arquivo foram atualizados, preservando os outros instaladores. Rollout 1/1 Ready, checksum, hash do bundle no pod e bytes servidos por `/extensions.js` foram conferidos; o bundle Top Bar anterior do Swagger não é mais servido. Catálogo e documentação Go/Java responderam pelo proxy autenticado.

Após a instalação, o usuário relatou ausência de Swagger no menu lateral. A v0.2.1 corrige a corrida identificada, com regressão sobre o bundle de produção; os testes simulados são separados da verificação em navegador real.

A navegação HTML para `/swagger` devolveu o shell do Argo CD. Essa verificação HTTP não comprova renderização do componente. Recarregue com Ctrl+Shift+R e abra Swagger no menu lateral. Navegador indisponível nesta sessão: menu, navegação e iframe continuam sem validação visual. [Registro com hashes e escopo das verificações](evidence/installation-v0.2.0-k3d-dev.json).

## Instalação histórica observada (v0.1.0)

A release v0.1.0 foi instalada no Deployment `argocd/argocd-server`, Argo CD 3.5.1, contexto `k3d-dev`. O rollout concluiu com 1/1 Ready; o instalador validou o checksum, e o hash no pod e o bundle servido por `/extensions.js` correspondem à release. Catálogo e docs das duas publicações responderam 200 pelo proxy autenticado. Instaladores anteriores foram preservados.

A validação visual não foi executada por indisponibilidade de navegador; interação e renderização no host continuam pendentes. Consulte o [registro com hashes e verificações](evidence/installation-v0.1.0-k3d-dev.json). Instalação persistente e comportamento real da UI são evidências distintas.
