import type {Application} from './types';
import {gatewayContext} from './gateway-context';
export function shouldDisplay(application?:Application):boolean {
  return !!gatewayContext(application);
}
