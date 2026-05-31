## Context

Phase 1 creates a source-owned native backend, Nx-managed pnpm monorepo, generated scoped native package workflow, and compatibility tests while intentionally preserving the current `wangluozhe/requests`-based wrapper behavior. That solves build ownership but keeps a duplicated HTTP-client layer: Node implements Fetch/client semantics while the Go backend also delegates through a complete Go `requests` client.

Phase 2 refactors the same unified Go backend lineage to remove `wangluozhe/requests` from the production path and execute requests directly through `chttp`. `chttp` remains an external Go module/repository and is treated as the Phase 2 substrate for fingerprint-sensitive wire behavior: uTLS ClientHello controls, JA3/random JA3, TLS extension controls, HTTP/2 settings/order controls, header order, pseudo-header order, and proxy transport mechanics.

The boundary becomes:

- Node owns policy: Fetch API, Request/Response/Headers/Body abstractions, Client/Session, cookies, redirects, validation, error mapping, timeout/AbortSignal policy, and body normalization where feasible.
- Native owns mechanics: one wire transaction, response metadata/body stream, TLS/HTTP2/header ordering controls, low-level proxy mechanics if required, and native stream resource lifecycle.

Phase 2 uses Phase 1 as the baseline. It should reuse the Phase 1 monorepo, native package generation, ABI tests, contract tests, and self-built backend behavior as compatibility gates.

## Goals / Non-Goals

**Goals:**

- Remove `wangluozhe/requests` from the production backend request path.
- Keep one unified Go backend lineage rather than adding a parallel backend.
- Preserve the generated scoped backend package model and runtime backend resolution introduced in Phase 1.
- Define and implement a slim native transport boundary on direct `chttp` usage.
- Move or confirm high-level HTTP-client policy in Node.
- Preserve public Fetch API behavior and no-silent-degradation guarantees.
- Prove Phase 2 behavior against Phase 1 compatibility baselines and fingerprint/transport fixtures.

**Non-Goals:**

- Do not implement the Phase 3 authorized Go `net/http` patch stack in this change.
- Do not vendor or maintain the `chttp` fork repository inside this monorepo.
- Do not keep Phase 1 `requests` backend as a parallel production backend after Phase 2 migration completes.
- Do not redesign the public package name or scoped backend package naming scheme.
- Do not intentionally introduce public Fetch API breaking changes.

## Decisions

### Decision: Refactor the existing backend lineage, not add a second backend

Phase 2 SHALL evolve the Phase 1 Go backend in place. The `requests`-based implementation may remain temporarily behind tests or migration branches during development, but the production backend line should converge on direct `chttp` usage.

Alternatives considered:

- Ship separate `requests` and `chttp` backends: rejected because it doubles maintenance and contradicts the unified backend plan.
- Start a new repository for Phase 2: rejected because Phase 1 already establishes monorepo build, packaging, and test infrastructure for the backend.

### Decision: Use direct `chttp` as the Phase 2 transport substrate

Phase 2 SHALL construct and execute requests through `chttp` primitives rather than `wangluozhe/requests`. This removes the duplicated Go HTTP-client layer while preserving the patched transport features Node cannot provide itself.

Alternatives considered:

- Direct uTLS: rejected for Phase 2 because HTTP/2 settings/order, header ordering, proxy transport, and response streaming would need to be rebuilt immediately.
- Keep `requests`: rejected because it preserves the duplicated HTTP-client layer that Phase 2 is intended to remove.

### Decision: Node owns high-level policy

Node SHALL own redirects, cookies/session behavior, Fetch object semantics, request validation, response construction, abort/timeout policy, and error mapping unless a behavior demonstrably requires native wire-level participation. Native SHALL accept an already-normalized transaction payload and return response metadata plus body/stream data.

Alternatives considered:

- Keep redirects/cookies/session in native: rejected because those are product/client policy and duplicate Node's Fetch implementation responsibilities.
- Move all HTTP framing to Node: rejected because Node's built-in HTTP clients do not expose all fingerprint-sensitive frame/settings/header-order controls required by this project.

### Decision: Preserve the Phase 1 external packaging shape

The main package SHALL remain pure JS/TS, and platform backend packages SHALL remain release-generated scoped packages. Phase 2 changes backend internals, not the package installation model.

Alternatives considered:

- Publish a separate Phase 2 backend package family: rejected because consumers should not need to choose backend architecture by package name.
- Bundle `chttp` source or the `chttp` repository into this monorepo: rejected because `chttp` is maintained separately and consumed as a Go module dependency.

### Decision: Use Phase 1 as the primary parity baseline

Phase 2 SHALL compare against the Phase 1 self-built backend for deterministic compatibility. The original closed binary may remain an additional oracle for historical behavior, but Phase 1 becomes the baseline for the owned backend lineage.

Alternatives considered:

- Compare only to the closed binary: rejected because Phase 2 is built on top of Phase 1 outcomes and should avoid re-coupling the migration to closed artifacts.
- Skip parity tests because architecture changes are intentional: rejected because public behavior must remain stable.

## Risks / Trade-offs

- Direct `chttp` behavior may not exactly match `requests` defaults → Mitigation: enumerate every policy previously provided by `requests` and either implement it in Node or mark it intentionally out of scope.
- Cookie/redirect/session behavior can shift when moved to Node → Mitigation: add Node-owned policy tests before removing `requests` behavior from native.
- Some proxy or decompression behavior may straddle policy and transport → Mitigation: classify each behavior by whether it affects wire fingerprinting; keep only fingerprint-sensitive mechanics native.
- `chttp` is a patched `net/http` fork with maintenance burden → Mitigation: treat it as Phase 2 substrate and keep Phase 3 authorized patch-stack plan separate.
- ABI compatibility pressure may keep native thicker than desired → Mitigation: preserve external compatibility while simplifying internal responsibility boundaries incrementally.
- Phase 1 parity tests may encode `requests`-specific quirks → Mitigation: classify differences as public compatibility requirements vs implementation quirks before preserving them.

## Migration Plan

1. Start from Phase 1 after the source-owned backend, Nx monorepo, generated backend packages, and contract tests exist.
2. Inventory behavior currently provided by `wangluozhe/requests`: redirects, cookies/session, headers, body encoding, proxy handling, timeout, TLS/H2 config mapping, streaming, and errors.
3. Classify each behavior as Node-owned policy or native-owned wire mechanic.
4. Add or strengthen Node-owned policy tests for behavior moving out of native.
5. Replace the backend request construction path with direct `chttp` request/transport construction.
6. Keep the Node-facing native payload/response shape stable unless tests prove a new internal-only mapping is needed.
7. Run Phase 1-vs-Phase 2 parity tests for buffered request, stream lifecycle, memory cleanup, fingerprint controls, and packaging.
8. Remove `wangluozhe/requests` from the production backend dependency graph after parity and policy tests pass.

Rollback strategy: keep the last Phase 1 backend artifact and test baseline available during Phase 2 development. If direct `chttp` behavior fails parity gates, revert the internal backend refactor while preserving the Phase 1 packaging and monorepo structure.

## Open Questions

- Which `chttp` module path/version should Phase 2 consume before the separate authorized fork repository is published?
- Which behavior differences from `wangluozhe/requests` are acceptable because they are not part of the public Fetch API contract?
- Should decompression be Node-owned from the start of Phase 2, or preserved in native until a dedicated body-policy audit is complete?
