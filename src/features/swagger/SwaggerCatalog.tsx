import React, {useEffect, useState} from 'react';
import type {GatewayContext} from '../../argocd/gateway-context';
import {loadCatalog, loadDocumentation} from './client';
import type {Publication} from './client';

export function SwaggerCatalog({context, basePath}: {readonly context: GatewayContext; readonly basePath: string}) {
  const [items, setItems] = useState<readonly Publication[]>([]);
  const [selected, setSelected] = useState('');
  const [html, setHtml] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [docLoading, setDocLoading] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [docError, setDocError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogLoading(true); setCatalogError(''); setItems([]); setSelected(''); setHtml('');
    loadCatalog(context, controller.signal, basePath).then(publications => {
      if (!controller.signal.aborted) { setItems(publications); setSelected(publications[0]?.id || ''); }
    }).catch((error: Error) => { if (!controller.signal.aborted) setCatalogError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setCatalogLoading(false); });
    return () => controller.abort();
  }, [context.application, context.project, basePath, revision]);

  useEffect(() => {
    const controller = new AbortController();
    const publication = items.find(item => item.id === selected);
    setHtml(''); setDocError(''); setDocLoading(!!publication);
    if (publication) loadDocumentation(publication, context, controller.signal, basePath).then(document => {
      if (!controller.signal.aborted) setHtml(document);
    }).catch((error: Error) => { if (!controller.signal.aborted) setDocError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setDocLoading(false); });
    return () => controller.abort();
  }, [selected, items, context.application, context.project, basePath]);

  const active = items.find(item => item.id === selected);
  return <div className="swagger-content">
    <div className="swagger-toolbar">
      <div className="swagger-picker"><label htmlFor="swagger-publication">API publicada</label>
        <select id="swagger-publication" value={selected} disabled={catalogLoading || !items.length} onChange={event => setSelected(event.target.value)}>
          {!items.length && <option value="">Nenhuma API selecionada</option>}
          {items.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </div>
      <button type="button" onClick={() => setRevision(value => value + 1)} disabled={catalogLoading}>Atualizar catálogo</button>
    </div>
    <details className="swagger-help"><summary>Ajuda</summary>
      <p>Selecione uma API para visualizar sua documentação. O catálogo usa sua sessão e permissões do Argo CD.</p>
      <p>Esta PoC publica duas APIs de demonstração: Go e Java. A execução de chamadas (Try it out) está desabilitada.</p>
      <p>Se o acesso for negado, entre novamente e peça ao administrador a permissão de invocar a extensão swagger.</p>
    </details>
    {catalogLoading && <p role="status">Carregando catálogo…</p>}
    {catalogError && <p role="alert">{catalogError}</p>}
    {!catalogLoading && !catalogError && !items.length && <p role="status">Nenhuma API publicada neste catálogo.</p>}
    {active && <p className="swagger-caption">{active.application} · {active.namespace} · {active.project}</p>}
    {docLoading && <p role="status">Carregando documentação…</p>}
    {docError && <div role="alert"><p>{docError}</p><button type="button" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button></div>}
    {html && <iframe key={selected} title={`Documentação ${active?.title || selected}`} srcDoc={html} className="swagger-frame" referrerPolicy="same-origin" />}
  </div>;
}
