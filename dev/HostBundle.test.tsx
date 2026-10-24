import React from 'react';
import '@testing-library/jest-dom';
import * as ReactDOM from 'react-dom';
import {createRoot, type Root} from 'react-dom/client';
import {jsxRuntime} from './host-runtime';
import {act, screen, fireEvent} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import type {ExtensionsAPI} from '../src/argocd/types';
import {gatewayFetch} from './test-fixtures';

type SystemExtension = {component: React.ComponentType; title: string; path: string; icon: string};
let root: Root | undefined;
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  delete window.extensionsAPI;
});

test.each(['early', 'ready'])('production bundle loaded with %s host registers once and preserves authenticated data flow', async phase => {
  global.fetch = gatewayFetch() as unknown as typeof fetch;
  const globals = window as unknown as Record<string, unknown>;
  globals.React = React; globals.ReactDOM = ReactDOM; globals.ReactJSXRuntime = jsxRuntime;
  const listeners: Array<(extension: SystemExtension) => void> = [];
  // The audited service emits synchronously. App subscribes in its constructor
  // and never replays registrations that happened before that subscription.
  const registration = jest.fn((component: React.ComponentType, title: string, path: string, icon: string) => {
    const extension = {component, title, path, icon};
    listeners.forEach(listener => listener(extension));
  });
  const topBar = jest.fn();
  window.extensionsAPI = {registerSystemLevelExtension: registration, registerTopBarActionMenuExt: topBar} as unknown as ExtensionsAPI;
  class Host extends React.Component<object, {extensions: SystemExtension[]}> {
    constructor(props: object) {
      super(props);
      this.state = {extensions: []};
      listeners.push(extension => this.setState(state => ({extensions: [...state.extensions, extension]})));
    }
    render() {
      return <><nav aria-label="Menu lateral">{this.state.extensions.map(extension => <a key={extension.path} href={extension.path}><i className={`fa ${extension.icon}`} aria-hidden="true"/>{extension.title}</a>)}</nav>
        {this.state.extensions.map(({component: Component, title, path}) => <main key={path} aria-label={title}><Component/></main>)}</>;
    }
  }
  const container = document.createElement('div');
  container.id = 'app';
  document.body.appendChild(container);
  root = createRoot(container);
  const executeBundle = () => (0, eval)(readFileSync('dist/resources/extension-swagger-gateway.js', 'utf8'));
  await act(async () => {
    root?.render(<Host/>);
    if (phase === 'early') {
      expect(container.childElementCount).toBe(0);
      executeBundle();
      expect(registration).not.toHaveBeenCalled();
    }
  });
  if (phase === 'ready') await act(async () => executeBundle());
  expect(registration).toHaveBeenCalledTimes(1);
  expect(topBar).not.toHaveBeenCalled();
  expect(registration.mock.calls[0]).toHaveLength(4);
  expect(registration.mock.calls[0].slice(1)).toEqual(['Swagger', '/swagger', 'fa-book']);
  expect(screen.getByRole('link', {name: 'Swagger'})).toHaveAttribute('href', '/swagger');
  expect(screen.getByRole('main', {name: 'Swagger'})).toBeInTheDocument();
  expect(document.querySelector('i')).toHaveClass('fa', 'fa-book');
  await screen.findByTitle('Documentação Go demo');
  expect(fetch).toHaveBeenCalledWith('/extensions/swagger/api/v1/catalog', expect.objectContaining({credentials: 'same-origin', headers: {'Argocd-Application-Name': 'argocd:swagger-gateway', 'Argocd-Project-Name': 'appset'}}));
  fireEvent.change(screen.getByLabelText('API publicada'), {target: {value: 'java-demo'}});
  await screen.findByTitle('Documentação Java demo');
  expect(screen.queryByTitle('Documentação Go demo')).not.toBeInTheDocument();
  await act(async () => {
    const laterChild = document.createElement('aside');
    container.appendChild(laterChild);
    laterChild.remove();
  });
  expect(registration).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole('link', {name: 'Swagger'})).toHaveLength(1);
  expect(globals.React).toBe(React); expect(globals.ReactDOM).toBe(ReactDOM); expect(globals.ReactJSXRuntime).toBe(jsxRuntime);
});
