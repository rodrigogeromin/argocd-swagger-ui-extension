import React from 'react';
import '@testing-library/jest-dom';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {Extension, ExtensionFlyout} from '../src/app/Extension';
import {register, HostFlyout} from '../src/argocd/register';
import {shouldDisplay} from '../src/argocd/visibility';
import {argoBasePath} from '../src/argocd/gateway-context';
import type {ExtensionsAPI} from '../src/argocd/types';
import {validContext} from './fixtures/context';
import {gatewayFetch, response, publications, html} from './test-fixtures';

beforeEach(() => { global.fetch = gatewayFetch() as unknown as typeof fetch; });
afterEach(() => { document.querySelector('base')?.remove(); jest.restoreAllMocks(); });

test('host action label has no button or duplicate icon and never mutates context', () => {
  const before = JSON.stringify(validContext);
  render(<Extension {...validContext} />);
  expect(screen.getByText('Swagger')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(document.querySelector('i')).toBeNull();
  expect(JSON.stringify(validContext)).toBe(before);
});

test('visibility accepts only authorized PoC context and handles absence', () => {
  expect(shouldDisplay(validContext.application)).toBe(true);
  expect(shouldDisplay()).toBe(false);
  expect(shouldDisplay({...validContext.application, spec: {project: 'other'}})).toBe(false);
  expect(shouldDisplay({metadata: {name: 'other', namespace: 'argocd'}, spec: {project: 'appset'}})).toBe(false);
});

test('adapter registers exact audited arguments and a separate flyout', () => {
  const host = jest.fn();
  window.extensionsAPI = {registerTopBarActionMenuExt: host} as unknown as ExtensionsAPI;
  register(Extension);
  expect(host).toHaveBeenCalledWith(Extension, 'Swagger', 'swagger-gateway', HostFlyout, shouldDisplay, 'fa fa-book', true);
  delete window.extensionsAPI;
  expect(() => register(Extension)).toThrow('extensionsAPI');
});

test('missing flyout context gives a useful fallback without fetching', () => {
  render(<ExtensionFlyout />);
  expect(screen.getByRole('status')).toHaveTextContent('Abra a Application swagger-gateway');
  expect(fetch).not.toHaveBeenCalled();
});

test('loads catalog and HTML with auth headers, switches publication and clears stale iframe', async () => {
  const before = JSON.stringify(validContext);
  render(<HostFlyout {...validContext} />);
  expect(screen.getByRole('status')).toHaveTextContent('Carregando catálogo');
  const frame = await screen.findByTitle('Documentação Go demo');
  expect(frame.getAttribute('srcdoc')).toContain('/extensions/swagger/specs/go-demo');
  expect(fetch).toHaveBeenCalledWith('/extensions/swagger/api/v1/catalog', expect.objectContaining({credentials:'same-origin', headers:{'Argocd-Application-Name':'argocd:swagger-gateway','Argocd-Project-Name':'appset'}}));
  fireEvent.change(screen.getByLabelText('API publicada'), {target: {value: 'java-demo'}});
  await screen.findByTitle('Documentação Java demo');
  expect(screen.queryByTitle('Documentação Go demo')).not.toBeInTheDocument();
  expect(JSON.stringify(validContext)).toBe(before);
});

test('honors Argo base href for both bootstrap and iframe spec fetches', async () => {
  const base = document.createElement('base'); base.href = '/argocd/'; document.head.append(base);
  render(<HostFlyout {...validContext} />);
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
  render(<HostFlyout {...validContext} />);
  await screen.findByText('Nenhuma API publicada neste catálogo.');
  expect(screen.queryByRole('iframe')).not.toBeInTheDocument();
});

test('access denied can be retried without exposing server response', async () => {
  const mock = jest.fn().mockResolvedValueOnce(response('internal secret',403)).mockImplementation(gatewayFetch());
  global.fetch = mock;
  render(<HostFlyout {...validContext} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Sem permissão');
  expect(document.body).not.toHaveTextContent('internal secret');
  fireEvent.click(screen.getByRole('button', {name:'Atualizar catálogo'}));
  await screen.findByTitle('Documentação Go demo');
});

test('failed HTML request offers retry and renders no iframe', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(response({items:publications})).mockResolvedValueOnce(response('bad',502)).mockImplementation(gatewayFetch());
  render(<HostFlyout {...validContext} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('indisponível');
  fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));
  await screen.findByTitle('Documentação Go demo');
});

test('unmount cancels in-flight fetch', async () => {
  let signal: AbortSignal | undefined;
  global.fetch = jest.fn((_url, options) => { signal=options?.signal as AbortSignal; return new Promise(() => {}); });
  const {unmount} = render(<HostFlyout {...validContext} />);
  await waitFor(() => expect(signal).toBeDefined());
  unmount();
  expect(signal?.aborted).toBe(true);
});

test('late documentation response cannot replace a newer selection', async () => {
  let finishGo: ((value: Response) => void) | undefined;
  global.fetch = jest.fn().mockResolvedValueOnce(response({items:publications}))
    .mockImplementationOnce(() => new Promise<Response>(resolve => {finishGo=resolve;}))
    .mockResolvedValueOnce(response(html('java-demo'),200,'text/html'));
  render(<HostFlyout {...validContext} />);
  await screen.findByRole('option',{name:'Go demo'});
  await waitFor(() => expect(finishGo).toBeDefined());
  fireEvent.change(screen.getByLabelText('API publicada'),{target:{value:'java-demo'}});
  await screen.findByTitle('Documentação Java demo');
  finishGo!(response(html('go-demo'),200,'text/html'));
  await waitFor(() => expect(screen.getByTitle('Documentação Java demo').getAttribute('srcdoc')).toContain('java-demo'));
});
