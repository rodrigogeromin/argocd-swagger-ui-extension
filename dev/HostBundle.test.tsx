import React from 'react';
import '@testing-library/jest-dom';
import * as ReactDOM from 'react-dom';
import {jsxRuntime} from './host-runtime';
import {render, screen, cleanup, fireEvent} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import type {ExtensionsAPI} from '../src/argocd/types';
import {gatewayFetch} from './test-fixtures';

test('production bundle registers a sidebar page without props and preserves authenticated data flow', async () => {
  global.fetch = gatewayFetch() as unknown as typeof fetch;
  const globals=window as unknown as Record<string, unknown>;
  globals.React=React; globals.ReactDOM=ReactDOM; globals.ReactJSXRuntime=jsxRuntime;
  const registration=jest.fn(), topBar=jest.fn();
  window.extensionsAPI={registerSystemLevelExtension: registration,registerTopBarActionMenuExt:topBar} as unknown as ExtensionsAPI;
  (0,eval)(readFileSync('dist/resources/extension-swagger-gateway.js','utf8'));
  expect(registration).toHaveBeenCalledTimes(1);
  expect(topBar).not.toHaveBeenCalled();
  const [Component,title,path,icon]=registration.mock.calls[0] as [React.ComponentType,string,string,string];
  expect(registration.mock.calls[0]).toHaveLength(4);
  expect([title,path,icon]).toEqual(['Swagger','/swagger','fa-book']);
  // Exact v3.5.1 consumer adds the fa prefix, creates a sidebar route and
  // wraps the component in Page, rendering it without Application/tree props.
  render(<><nav aria-label="Menu lateral"><a href={path}><i className={`fa ${icon}`} aria-hidden="true"/>{title}</a></nav><main aria-label={title}><Component/></main></>);
  expect(screen.getByRole('link',{name:'Swagger'})).toHaveAttribute('href','/swagger');
  expect(document.querySelector('i')).toHaveClass('fa','fa-book');
  await screen.findByTitle('Documentação Go demo');
  expect(fetch).toHaveBeenCalledWith('/extensions/swagger/api/v1/catalog',expect.objectContaining({credentials:'same-origin',headers:{'Argocd-Application-Name':'argocd:swagger-gateway','Argocd-Project-Name':'appset'}}));
  fireEvent.change(screen.getByLabelText('API publicada'),{target:{value:'java-demo'}});
  await screen.findByTitle('Documentação Java demo');
  expect(screen.queryByTitle('Documentação Go demo')).not.toBeInTheDocument();
  expect(globals.React).toBe(React); expect(globals.ReactDOM).toBe(ReactDOM); expect(globals.ReactJSXRuntime).toBe(jsxRuntime);
  cleanup(); delete window.extensionsAPI;
});
