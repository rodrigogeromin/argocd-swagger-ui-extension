import React from 'react';
import '@testing-library/jest-dom';
import * as ReactDOM from 'react-dom';
import {jsxRuntime} from './host-runtime';
import {render, screen, cleanup, fireEvent} from '@testing-library/react';
import {readFileSync} from 'node:fs';
import type {ExtensionProps, ExtensionsAPI, FlyoutProps} from '../src/argocd/types';
import {validContext} from './fixtures/context';
import {gatewayFetch} from './test-fixtures';

test('production bundle obeys host registration, wrapper ownership, context and authenticated data flow', async () => {
  global.fetch = gatewayFetch() as unknown as typeof fetch;
  const globals=window as unknown as Record<string, unknown>;
  globals.React=React; globals.ReactDOM=ReactDOM; globals.ReactJSXRuntime=jsxRuntime;
  const registration=jest.fn();
  window.extensionsAPI={registerTopBarActionMenuExt: registration} as unknown as ExtensionsAPI;
  (0,eval)(readFileSync('dist/resources/extension-swagger-gateway.js','utf8'));
  expect(registration).toHaveBeenCalledTimes(1);
  const [Component,title,id,Flyout,visible,icon,isMiddle]=registration.mock.calls[0] as [React.ComponentType<ExtensionProps>,string,string,React.ComponentType<FlyoutProps>,(app?: typeof validContext.application)=>boolean,string,boolean];
  expect([title,id,icon,isMiddle]).toEqual(['Swagger','swagger-gateway','fa fa-book',true]);
  expect(visible(validContext.application)).toBe(true); expect(visible()).toBe(false);
  const before=JSON.stringify(validContext);
  function freeze(value:unknown){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}}
  freeze(validContext);
  const open=jest.fn();
  render(<button onClick={open}><i className={icon} aria-hidden="true"/><Component {...validContext}/></button>);
  expect(document.querySelectorAll('button')).toHaveLength(1);
  expect(document.querySelectorAll('i')).toHaveLength(1);
  expect(document.querySelector('button button')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Swagger'})); expect(open).toHaveBeenCalledTimes(1);
  cleanup(); render(<Flyout application={validContext.application} tree={validContext.tree}/>);
  await screen.findByTitle('Documentação Go demo');
  fireEvent.change(screen.getByLabelText('API publicada'),{target:{value:'java-demo'}});
  await screen.findByTitle('Documentação Java demo');
  expect(JSON.stringify(validContext)).toBe(before);
  expect(globals.React).toBe(React); expect(globals.ReactDOM).toBe(ReactDOM); expect(globals.ReactJSXRuntime).toBe(jsxRuntime);
  cleanup(); render(<Flyout/>); expect(screen.getByRole('status')).toHaveTextContent('Abra a Application');
  delete window.extensionsAPI;
});
