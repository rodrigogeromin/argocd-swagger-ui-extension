import {createElement, useState} from 'react';
import type {ComponentType} from 'react';
import {readGatewayContext, argoBasePath} from './gateway-context';
import type {ProjectRegistration} from './types';
import project from '../../extension-project.json';
import {Extension} from '../app/Extension';

// Argo CD system pages are rendered without Application or tree props.
export function HostPage() {
  const [configuration] = useState<{context?: ReturnType<typeof readGatewayContext>; configError?: string}>(() => {
    try { return {context: readGatewayContext()}; }
    catch (error) { return {configError: (error as Error).message}; }
  });
  return createElement(Extension, {...configuration, basePath: argoBasePath()});
}

export function register(component: ComponentType): void {
  const host = window.extensionsAPI;
  if (!host) throw new Error('Argo CD extensionsAPI is unavailable; use npm run dev for preview');
  const registration = project.registration as ProjectRegistration;
  const args = project.hostContract.argumentMap.map(token => {
    if (token === 'component') return component;
    if (token.startsWith('registration.')) return registration[token.slice('registration.'.length) as keyof ProjectRegistration];
    throw new Error(`Unsupported host argument mapping: ${token}`);
  });
  const method = host[project.hostContract.method as 'registerSystemLevelExtension'];
  if (typeof method !== 'function') throw new Error(`Argo CD extensionsAPI.${project.hostContract.method} is unavailable`);
  Reflect.apply(method, host, args);
}
