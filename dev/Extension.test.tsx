import React from 'react';
import '@testing-library/jest-dom';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {register, HostPage} from '../src/argocd/register';
import {argoBasePath, readGatewayContext} from '../src/argocd/gateway-context';
import type {ExtensionsAPI} from '../src/argocd/types';
import {gatewayFetch, response, publications, html} from './test-fixtures';

beforeEach(() => { global.fetch = gatewayFetch() as unknown as typeof fetch; window.swaggerGatewayConfig = {application:'argocd:swagger-gateway',project:'appset'}; });
afterEach(() => { document.querySelector('base')?.remove(); delete window.swaggerGatewayConfig; jest.restoreAllMocks(); });

test('adapter registers exactly one independent system page and no Top Bar action', () => {
  const host = jest.fn();
  const topBar = jest.fn();
  window.extensionsAPI = {registerSystemLevelExtension: host, registerTopBarActionMenuExt: topBar} as unknown as ExtensionsAPI;
  register(HostPage);
  expect(host).toHaveBeenCalledTimes(1);
  expect(host).toHaveBeenCalledWith(HostPage, 'Swagger', '/swagger', 'fa-book');
  expect(topBar).not.toHaveBeenCalled();
  delete window.extensionsAPI;
  expect(() => register(HostPage)).toThrow('extensionsAPI');
});

test('reads and freezes alternate runtime proxy context', () => {
  window.swaggerGatewayConfig = {application:'team-a:catalog',project:'platform'};
  const context = readGatewayContext();
  expect(context).toEqual({application:'team-a:catalog',project:'platform'});
  expect(Object.isFrozen(context)).toBe(true);
});

test('loads catalog and HTML with auth headers, switches publication and clears stale iframe', async () => {
  const before = JSON.stringify(window.swaggerGatewayConfig);
  render(<HostPage />);
  expect(screen.getByRole('status')).toHaveTextContent('Carregando catálogo');
  const frame = await screen.findByTitle('Documentação Go demo');
  expect(frame.getAttribute('srcdoc')).toContain('/extensions/swagger/specs/go-demo');
  expect(fetch).toHaveBeenCalledWith('/extensions/swagger/api/v1/catalog', expect.objectContaining({credentials:'same-origin', headers:{'Argocd-Application-Name':'argocd:swagger-gateway','Argocd-Project-Name':'appset'}}));
  fireEvent.change(screen.getByLabelText('API publicada'), {target: {value: 'java-demo'}});
  await screen.findByTitle('Documentação Java demo');
  expect(screen.queryByTitle('Documentação Go demo')).not.toBeInTheDocument();
  expect(JSON.stringify(window.swaggerGatewayConfig)).toBe(before);
});

test('uses alternate runtime context and accepts publications owned elsewhere', async () => {
  window.swaggerGatewayConfig = {application:'team-a:catalog',project:'platform'};
  render(<HostPage />);
  await screen.findByTitle('Documentação Go demo');
  expect(fetch).toHaveBeenCalledWith('/extensions/swagger/api/v1/catalog', expect.objectContaining({headers:{'Argocd-Application-Name':'team-a:catalog','Argocd-Project-Name':'platform'}}));
});

test('missing or invalid runtime config shows setup error without gateway requests', async () => {
  delete window.swaggerGatewayConfig;
  render(<HostPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('application e project');
  expect(fetch).not.toHaveBeenCalled();
  expect(() => readGatewayContext({application:'',project:'appset'})).toThrow('inválida');
});

test('malformed runtime config shows setup error without gateway requests', async () => {
  window.swaggerGatewayConfig = {application:'team-a',project:'appset'};
  render(<HostPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Configuração Swagger Gateway inválida');
  expect(fetch).not.toHaveBeenCalled();
  expect(() => readGatewayContext({application:'team-a:catalog:extra',project:'appset'})).toThrow('inválida');
  expect(() => readGatewayContext({application:':catalog',project:'appset'})).toThrow('inválida');
  expect(() => readGatewayContext({application:'team-a:',project:'appset'})).toThrow('inválida');
});

test('honors Argo base href for both bootstrap and iframe spec fetches', async () => {
  const base = document.createElement('base'); base.href = '/argocd/'; document.head.append(base);
  render(<HostPage />);
  const frame = await screen.findByTitle('Documentação Go demo');
  expect(fetch).toHaveBeenCalledWith('/argocd/extensions/swagger/api/v1/catalog', expect.anything());
  expect(frame.getAttribute('srcdoc')).toContain('/argocd/extensions/swagger/specs/go-demo');
});

test('rejects a cross-origin base href', () => {
  const base = document.createElement('base'); base.href = 'https://outside.example/'; document.head.append(base);
  expect(argoBasePath).toThrow('base URL');
});

test('empty catalog displays an empty state', async () => {
  global.fetch = jest.fn().mockResolvedValue(response({items: []}));
  render(<HostPage />);
  await screen.findByText('Nenhuma API publicada neste catálogo.');
  expect(screen.queryByRole('iframe')).not.toBeInTheDocument();
});

test('access denied can be retried without exposing server response', async () => {
  const mock = jest.fn().mockResolvedValueOnce(response('internal secret',403)).mockImplementation(gatewayFetch());
  global.fetch = mock;
  render(<HostPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Sem permissão');
  expect(document.body).not.toHaveTextContent('internal secret');
  fireEvent.click(screen.getByRole('button', {name:'Atualizar catálogo'}));
  await screen.findByTitle('Documentação Go demo');
});

test('failed HTML request offers retry and renders no iframe', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(response({items:publications})).mockResolvedValueOnce(response('bad',502)).mockImplementation(gatewayFetch());
  render(<HostPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('indisponível');
  fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));
  await screen.findByTitle('Documentação Go demo');
});

test('unmount cancels in-flight fetch', async () => {
  let signal: AbortSignal | undefined;
  global.fetch = jest.fn((_url, options) => { signal=options?.signal as AbortSignal; return new Promise(() => {}); });
  const {unmount} = render(<HostPage />);
  await waitFor(() => expect(signal).toBeDefined());
  unmount();
  expect(signal?.aborted).toBe(true);
});

test('late documentation response cannot replace a newer selection', async () => {
  let finishGo: ((value: Response) => void) | undefined;
  global.fetch = jest.fn().mockResolvedValueOnce(response({items:publications}))
    .mockImplementationOnce(() => new Promise<Response>(resolve => {finishGo=resolve;}))
    .mockResolvedValueOnce(response(html('java-demo'),200,'text/html'));
  render(<HostPage />);
  await screen.findByRole('option',{name:'Go demo'});
  await waitFor(() => expect(finishGo).toBeDefined());
  fireEvent.change(screen.getByLabelText('API publicada'),{target:{value:'java-demo'}});
  await screen.findByTitle('Documentação Java demo');
  finishGo!(response(html('go-demo'),200,'text/html'));
  await waitFor(() => expect(screen.getByTitle('Documentação Java demo').getAttribute('srcdoc')).toContain('java-demo'));
});
