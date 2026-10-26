# Catálogo Swagger

Abra **Swagger** no menu lateral do Argo CD, rota `/swagger`, sem selecionar Application.
Selecione uma publicação Go ou Java para carregar a documentação na página completa.
**Atualizar catálogo** busca novamente as publicações; erros permitem nova tentativa.

O adapter fornece o contexto explícito e imutável pelo `window.swaggerGatewayConfig`, injetado via ConfigMap por instalação. Configure `application` (formato `namespace:name`) e `project`; mudanças exigem reiniciar `argocd-server`.
O catálogo e o HTML são buscados na origem do Argo CD com a sessão atual e headers
de contexto. O HTML universal do gateway é atribuído a `iframe.srcdoc`; o próprio
HTML usa o interceptor Swagger para autenticar a busca da especificação.
O host cria o menu e a página sem fornecer props de Application ou tree.

Try it out está desabilitado pelo gateway da PoC. O usuário precisa de permissão
`applications, get, <project>/<application-name>` para o contexto configurado e
`extensions, invoke, swagger`.
A autorização server-side permanece obrigatória mesmo com o menu visível.
Os metadados de Application e Project das publicações são independentes do
contexto usado para autorizar as requisições ao proxy. O gateway controla quais
publicações a sessão pode consultar; a extensão não faz discovery Kubernetes.
