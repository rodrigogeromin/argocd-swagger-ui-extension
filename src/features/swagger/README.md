# Catálogo Swagger

Abra **Swagger** no menu lateral do Argo CD, rota `/swagger`, sem selecionar Application.
Selecione uma publicação Go ou Java para carregar a documentação na página completa.
**Atualizar catálogo** busca novamente as publicações; erros permitem nova tentativa.

O adapter fornece o contexto explícito e imutável `argocd:swagger-gateway` / `appset`.
O catálogo e o HTML são buscados na origem do Argo CD com a sessão atual e headers
de contexto. O HTML universal do gateway é atribuído a `iframe.srcdoc`; o próprio
HTML usa o interceptor Swagger para autenticar a busca da especificação.
O host cria o menu e a página sem fornecer props de Application ou tree.

Try it out está desabilitado pelo gateway da PoC. O usuário precisa de permissão
`applications, get, appset/swagger-gateway` e `extensions, invoke, swagger`.
A autorização server-side permanece obrigatória mesmo com o menu visível.
O catálogo atual está restrito à Application da PoC; não é um catálogo de todas
as Applications nem discovery Kubernetes.
