---
title: 'Runtime configurable proxy context'
type: 'feature'
ticket: ''
created: '2026-10-26'
status: 'built'
baseline_revision: 'd4cebbbf8f368f2172f1fbcfee2a1fecfb142248'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The system-level Swagger extension sends a fixed Application and Project in every gateway request. Clusters with different Argo CD naming taxonomies cannot use the same published extension bundle, even when their gateway and ApplicationSet are installed correctly.

**Approach:** Read the proxy context from a small JavaScript configuration file mounted by the installation manifests from a ConfigMap. Keep the bundle generic, validate configuration at runtime, and treat catalog publication ownership as metadata independent from the proxy context.

## Boundaries & Constraints

**Always:** Use Argo CD's authenticated proxy and current user session. Keep server-side RBAC authoritative. The installation config names an existing Application and its Project; changing the ConfigMap takes effect after the argocd-server pod restarts. Keep the context immutable for each rendered extension instance.

**Never:** Recompile or republish the UI to change cluster-specific names. Discover an arbitrary Application automatically, accept context values from the gateway response, or weaken server-side authorization. Do not change existing gateway endpoint paths or trusted HTML handling.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid runtime config | Config JS provides non-empty Application and Project | Catalog and docs requests carry those exact headers | No error expected |
| Missing or malformed config | Config JS absent or either value empty | Show a clear setup error; do not issue a gateway request | Explain which installation values need configuration |
| Catalog lists remote publications | Publication Application/Project differs from proxy context | Render the catalog entry and its metadata | Gateway remains responsible for authorization |

</frozen-after-approval>

## Code Map

- `src/argocd/gateway-context.ts` -- currently exports the immutable PoC context; make it read and validate the installed runtime config.
- `src/features/swagger/client.ts` -- attaches context headers and currently rejects catalog items unless their Application and Project equal the single request context. Retain URL and shape checks, remove the invalid single-context ownership comparison.
- `src/features/swagger/SwaggerCatalog.tsx` -- consumes context and renders client errors; use this behavior for a missing-config message without issuing requests.
- `deploy/argocd-server-patch.yaml` -- release patch installs the bundle into the shared `/tmp/extensions` volume. Add a read-only ConfigMap file mount in the server container at a lexically earlier `extension-*.js` path.
- `scripts/package.mjs` -- deliberately packages one regular JS file. Installer v1.1.0's `EXTENSION_JS_VARS` code searches for a directory matching that JS filename, so that feature does not work with this archive; leave package shape unchanged and supply config separately.
- `dev/Extension.test.tsx`, `dev/Client.test.tsx`, `dev/HostBundle.test.tsx`, `dev/test-fixtures.ts` -- adapter, catalog, and real-bundle harness assertions currently assume PoC constants.
- `README.md`, `docs/installation.md` -- document the per-install ConfigMap, required restart, and cluster verification.

## Tasks & Acceptance

**Execution:**
- [x] `src/argocd/gateway-context.ts`, `src/features/swagger/client.ts` -- consume runtime context, report invalid setup clearly, and allow the catalog to list Applications unrelated to the proxy context.
- [x] `deploy/argocd-server-patch.yaml`, `deploy/swagger-gateway-config.yaml` -- add a ConfigMap mount that provides a generated-before-bundle JavaScript config file; document values in the example manifest.
- [x] `dev/test-fixtures.ts`, `dev/Extension.test.tsx`, `dev/Client.test.tsx`, `dev/HostBundle.test.tsx` -- cover alternate context values, missing config, independent publication identity, and the production bundle reading the injected global.
- [x] `README.md`, `docs/installation.md` -- replace the fixed-context setup instructions with the ConfigMap workflow and explain restart behavior.
- [x] Local validation and lab integration -- run repository validation, install the built bundle plus runtime config into `k3d-argocd-lab`, verify served script order and request headers with a second existing Application context, then restore the lab's working context and record hashes and observations.

**Acceptance Criteria:**
- Given a cluster-specific ConfigMap, when the same production bundle runs, then proxy requests use the configured Application and Project headers without rebuilding the bundle.
- Given a catalog entry owned by another Application or Project, when the gateway returns it, then the extension accepts it while preserving schema, ID, and URL validation.
- Given missing or invalid installation configuration, when the page loads, then the extension presents an actionable error and sends no request with fallback credentials or hard-coded context.
- Given the local Argo CD 3.5.1 lab, when the configured context is changed to another existing authorized Application, then the served extension uses the new headers; after verification, the lab is returned to its original functional context.

## Implementation Notes

- Initial local validation passed after runtime configuration was implemented. Review found that Argo CD only serves extension JavaScript whose filename begins with `extension`; the ConfigMap key and mount were corrected to `extension-0-swagger-gateway-config.js` so it sorts before the bundle. The actual local cluster runs Argo CD `v3.5.6`, not `v3.5.1`; integration observations will record `3.5.6` and will not change the audited compatibility matrix.
- Final validation passed with 51 unit/domain tests and 2 production-bundle harness cases. The lab was switched to the existing `argocd:swagger-petstore` / `appset` context, the served `/extensions.js` placed configuration before the bundle, and the harness confirmed the matching request headers. The ConfigMap and rollout were restored to `argocd:swagger-gateway` / `appset`. No authenticated browser request was available; the lab remains running the locally built bundle via a temporary bundle ConfigMap.
- Quick review caught that a non-empty Application without the required colon-delimited namespace was accepted. The adapter now requires exactly two non-empty `namespace:name` segments; the malformed-config UI test checks that no request is sent. The focused adapter suite (13 tests), full validation, evidence check, and diff whitespace check passed.
- Final local artifacts: bundle SHA-256 `d91b7465eee3198274cc5da871c75d349c94e627d9fc4c635c3b657c159b414e`; package SHA-256 `0e4c5db23c2181b5d5b38dc7cc45dd17226dd8f28f664d87d2527e80b517412a`. The final bundle was installed into the lab, and the alternate ConfigMap context appeared before it in the served script. The lab is back on the original context, running Argo CD 3.5.6; no authenticated browser request was observed.

## Plan Change Log

## Review Triage Log

- medium — patch: `src/argocd/gateway-context.ts` aceita um nome de Application sem `namespace:name`, então o cliente envia um header que o proxy não aceita em vez de mostrar erro de configuração; o contrato oficial do proxy exige `<namespace>:<app-name>`, e o teste deve provar que contexto malformado não gera fetch.

## Design Notes

The extension installer v1.1.0 advertises `EXTENSION_JS_VARS`, but its v1.1.0 script locates the installed bundle using `find -type d -name "extension*-$ext_name*.js"`; this repository's archive contains a regular file. Mount a separate config script into `/tmp/extensions/resources` with a filename sorted before `extension-swagger-gateway.js`. The Argo CD 3.5.1 server includes matching files in path order while building `/extensions.js`, so the global is defined before the extension bundle executes. The unit and host harness should verify this ordering contract.

## Verification

**Commands:**
- `npm run validate` -- expected: type, lint, domain tests, production bundle harness, and packaging succeed.
- `npm run evidence:check` -- expected: reports match the built bundle and package.
- `kubectl rollout status deployment/argocd-server -n argocd` -- expected: lab rollout completes after the temporary test deployment update.
- Read live `/extensions.js` and inspect pod files / request log -- expected: config global precedes the bundle and the alternate context appears in both request headers.
