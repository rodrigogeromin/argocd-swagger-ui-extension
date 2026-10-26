import React from 'react';
import {mount} from './runtime';
import {HostPage} from '../src/argocd/register';
import project from '../extension-project.json';
import './preview.css';
import {installPreviewGateway} from './mock-gateway';
installPreviewGateway();
window.swaggerGatewayConfig = Object.freeze({application:'argocd:swagger-gateway',project:'appset'});
const query = new URLSearchParams(location.search);
const element = document.getElementById('root');
if (!element) throw new Error('Missing preview root');
if (query.get('theme') === 'dark') element.dataset.theme = 'dark';
function Preview() {
 return <div className="preview-panel" style={{width:query.get('width')??'100%',height:query.get('height')??'100%'}}>
   <nav aria-label="Menu lateral"><a href={project.registration.path}><i className={`fa ${project.registration.icon}`} aria-hidden="true"/>{project.registration.title}</a></nav>
   <main aria-label={project.registration.title}><p>Preview local · catálogo simulado · Argo CD 3.5.1</p><HostPage /></main>
 </div>;
}
mount(element,<Preview/>);
