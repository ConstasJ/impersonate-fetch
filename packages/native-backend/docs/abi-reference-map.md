# Phase 1 ABI reference map

Current source status: `refs/psuedocodes/` is not checked in to this worktree.

This map records the Phase 1 wrapper references named by the OpenSpec design and keeps the
missing reference material visible to implementers. Do not implement parity-sensitive wrapper
behavior from memory; use this map as the checklist once the pseudocode files are restored, and
treat runnable contract or differential tests as authoritative if they disagree with pseudocode.

| ABI behavior | Expected pseudocode reference | Observable behavior to verify |
| --- | --- | --- |
| `request` | `refs/psuedocodes/main.request.c` | Accept `NativeRequestPayload` JSON, execute a buffered request, return `NativeResponsePayload` JSON, and store the returned C string by response `id` for `freeMemory`. |
| `stream_request` | `refs/psuedocodes/main.streamRequest.c` | Accept a stream request payload, open the response body without buffering it, return stream metadata containing `stream_id`, and register stream-owned cleanup state. |
| `stream_read` | `refs/psuedocodes/main.streamRead.c` | Read at most the requested chunk size, return base64 data and EOF state, and replace the previous `${stream_id}_read` C string allocation before storing the new result. |
| `stream_close` | `refs/psuedocodes/main.streamClose.c` | Close the response body, remove the stream from the stream pool, and release stream metadata plus `${stream_id}_read` pointer state. |
| `freeMemory` | `refs/psuedocodes/main.freeMemory.c` | Release the C string allocation stored under the response `id` returned from `request`. |
| `request construction` | `refs/psuedocodes/main.buildRequest.c` | Translate `NativeRequestPayload` fields into the transitional `wangluozhe/requests` request object without requiring Node-side schema changes. |
| `session behavior` | `refs/psuedocodes/main.GetSession.c` | Resolve or create session state from payload `Id` and preserve existing lifecycle behavior until `freeSession` semantics are verified. |

## Missing-reference handling

- The expected path spelling is `refs/psuedocodes/` because the OpenSpec artifacts use that path.
- If the extracted files are added later, update this map with concrete notes from each file before
  marking the corresponding ABI implementation tasks complete.
- Until those files are available, implementation work must be limited to behavior covered by local
  contract tests, differential tests, or the TypeScript ABI contract in
  `packages/impersonated-fetch/src/native/abi.ts`.
