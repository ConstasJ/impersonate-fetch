## Why

The native backend workflow currently builds the full eight-target artifact matrix for both trusted
`master` changes and pull requests that touch broad dependency/package paths. That makes PR feedback
more expensive than necessary and blurs the line between ordinary validation and trusted release
candidate artifact production.

## What Changes

- Keep `.github/workflows/native-backend.yml` as the trusted cross-platform artifact producer for
  `workflow_dispatch` and path-filtered pushes to `master`.
- Refine pull request behavior so PRs remain cautious validation runs rather than automatic full
  release-candidate artifact production for general package or JavaScript-only changes.
- Preserve the supported native target matrix and uploaded `native-backend-*` artifact shape for
  trusted runs consumed by the release workflow through `native_run_id`.
- Document the trigger boundary between general CI, native backend validation, and release artifact
  production.
- No breaking API or package changes.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `owned-native-backend`: Clarify when the native backend matrix workflow should run as a trusted
  artifact producer versus PR validation.
- `nx-monorepo-workspace`: Clarify graph-aware CI boundaries so JavaScript-only changes do not
  unnecessarily trigger unrelated native artifact matrix builds.

## Impact

- `.github/workflows/native-backend.yml` trigger filters, PR gating, and any related job conditions.
- `.github/workflows/ci.yml` remains the ordinary PR/push validation surface for JavaScript package,
  package validation, native host build/test, and OS compatibility checks.
- Release automation continues to consume explicit trusted native workflow artifacts through
  `native_run_id`; `.github/workflows/release.yml` publish behavior is out of scope.
- OpenSpec specs for native backend matrix support and Nx graph-aware orchestration.
