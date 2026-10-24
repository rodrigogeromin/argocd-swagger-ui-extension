import {loadCatalog, loadDocumentation, publicUrl} from '../src/features/swagger/client';
import {context, publications, response} from './test-fixtures';
const signal = () => new AbortController().signal;
afterEach(() => jest.useRealTimers());
test.each([
  {items:[{...publications[0],uiUrl:'https://outside.example/api'}]},
  {items:[{...publications[0],project:'other'}]},
  {items:[{...publications[0],application:'other'}]},
  {items:[publications[0],publications[0]]},
  {items:[{id:'incomplete'}]}, {items:'wrong'}, {}, 'not-json'
])('rejects invalid or unauthorized catalog: %j', async body => {
  global.fetch = jest.fn().mockResolvedValue(response(body));
  await expect(loadCatalog(context,signal())).rejects.toThrow();
});
test.each([400,401,403,404,500,502,504])('handles HTTP %i', async status => {
  global.fetch = jest.fn().mockResolvedValue(response('private detail',status));
  await expect(loadCatalog(context,signal())).rejects.not.toThrow('private detail');
});
test('refuses arbitrary URLs and path traversal', () => {
  for (const url of ['https://evil/api','//evil','/extensions/swagger/ui/../secret','/api/v1/catalog']) expect(() => publicUrl(url,'/')).toThrow();
});
test('refuses non-HTML documentation', async () => {
  global.fetch = jest.fn().mockResolvedValue(response('not html'));
  await expect(loadDocumentation(publications[0],context,signal())).rejects.toThrow('página de documentação válida');
});
test('timeouts cancel the request and produce a helpful error', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn((_url, options) => new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('aborted')))));
  const pending = expect(loadCatalog(context,signal())).rejects.toThrow('demorou para responder');
  await jest.advanceTimersByTimeAsync(15000);
  await pending;
});
