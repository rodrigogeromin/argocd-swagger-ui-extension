import type {ExtensionProps} from '../../src/argocd/types';
export const validContext: ExtensionProps = {
  application: {metadata: {name: 'swagger-gateway', namespace: 'argocd'}, spec: {project: 'appset'}, status: {health: {status: 'Healthy'}, sync: {status: 'Synced'}}},
  resource: {group: 'argoproj.io', kind: 'Application', metadata: {name: 'example-application', namespace: 'argocd'}},
  tree: {nodes: [{kind: 'Deployment', name: 'example-deployment', namespace: 'demo'}]}
};
export const absentContext: ExtensionProps = {};
