import {registerWhenHostMounted} from './startup';
import {register} from './register';

jest.mock('./register', () => ({register: jest.fn()}));
const Component = () => null;
afterEach(() => {
  document.body.replaceChildren();
  jest.restoreAllMocks();
  jest.mocked(register).mockReset();
});

test('missing host root fails explicitly', () => {
  expect(() => registerWhenHostMounted(Component)).toThrow('Argo CD host root #app is unavailable');
  expect(register).not.toHaveBeenCalled();
});

test('ready host registers immediately without an observer', () => {
  document.body.innerHTML = '<div id="app"><main></main></div>';
  const observe = jest.spyOn(MutationObserver.prototype, 'observe');
  registerWhenHostMounted(Component);
  expect(register).toHaveBeenCalledTimes(1);
  expect(register).toHaveBeenCalledWith(Component);
  expect(observe).not.toHaveBeenCalled();
});

test('empty host waits for an element, disconnects before registering and ignores later mutations', async () => {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.getElementById('app')!;
  const disconnect = jest.spyOn(MutationObserver.prototype, 'disconnect');
  jest.mocked(register).mockImplementation(() => expect(disconnect).toHaveBeenCalledTimes(1));
  registerWhenHostMounted(Component);
  root.appendChild(document.createTextNode(' '));
  await Promise.resolve();
  expect(register).not.toHaveBeenCalled();
  root.appendChild(document.createElement('main'));
  await Promise.resolve();
  expect(register).toHaveBeenCalledTimes(1);
  root.appendChild(document.createElement('aside'));
  await Promise.resolve();
  expect(register).toHaveBeenCalledTimes(1);
});
