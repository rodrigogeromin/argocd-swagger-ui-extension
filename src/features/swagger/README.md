# Catálogo Swagger

Na Application `argocd/swagger-gateway` do projeto `appset`, abra a ação **Swagger**.
Selecione uma publicação Go ou Java para carregar a documentação no flyout.
**Atualizar catálogo** busca novamente as publicações; erros permitem nova tentativa.

O catálogo e o HTML são buscados na origem do Argo CD, com a sessão atual e headers
de contexto. O HTML universal do gateway é atribuído a `iframe.srcdoc`; o próprio
HTML usa o interceptor Swagger para autenticar a busca da especificação. O Argo CD
continua responsável pelo botão, ícone e fechamento do flyout.

Try it out está desabilitado pelo gateway da PoC. O usuário precisa de permissão
`applications, get, appset/swagger-gateway` e `extensions, invoke, swagger`.
O catálogo atual está restrito à Application da PoC; não é um catálogo de todas
as Applications nem discovery Kubernetes.
