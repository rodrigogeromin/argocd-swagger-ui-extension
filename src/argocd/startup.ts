import type {ComponentType} from 'react';
import {register} from './register';

export function registerWhenHostMounted(component: ComponentType): void {
  const root = document.getElementById('app');
  if (!root) throw new Error('Argo CD host root #app is unavailable');
  // React 19 createRoot.render is asynchronous. App subscribes to systemLevel
  // in its constructor, before the first DOM commit; earlier events are lost.
  if (root.childElementCount > 0) { register(component); return; }
  const observer = new MutationObserver(() => {
    if (root.childElementCount === 0) return;
    observer.disconnect();
    register(component);
  });
  observer.observe(root, {childList: true});
}
