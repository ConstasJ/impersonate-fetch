## Context

`.github/workflows/native-backend.yml` is now part of the release supply chain: it builds the eight
platform artifacts that `.github/workflows/release.yml` later consumes through an explicit
`native_run_id`. The same workflow also runs on pull requests with the same broad path filters used
for trusted `master` artifact production.

General project validation already has a separate surface in `.github/workflows/ci.yml`: Nx affected
checks, a host native backend build/test, OS build/test matrices, package validation, native asset
checks, and optional manual fingerprint smoke. That means the native backend workflow does not need
to be the default validation mechanism for JavaScript-only or general package changes.

## Goals / Non-Goals

**Goals:**

- Keep full native artifact matrix production available for trusted `master` changes that affect
  native artifact inputs.
- Keep `workflow_dispatch` as the manual release-candidate/rebuild path for producing artifacts used
  by `release.yml`.
- Make PR behavior more targeted so the full matrix is not automatically produced for broad package
  metadata or JavaScript-only changes.
- Preserve the existing artifact names, target matrix, Windows MSYS2 setup, and release
  `native_run_id` consumption contract.
- Document the CI boundary so contributors know which workflow validates which class of change.

**Non-Goals:**

- Changing release publishing, npm provenance, versioning, or `release.yml` inputs.
- Removing any supported native platform target.
- Replacing GitHub Actions Matrix with another build system.
- Introducing tag-triggered release artifact routing.

## Decisions

### Keep trusted artifact production on `workflow_dispatch` and path-filtered `master` pushes

The full matrix should continue to run when a maintainer manually requests artifacts or when changes
land on `master` and touch native artifact inputs. These runs are the appropriate candidates for
`native_run_id` because they run from trusted repository state and produce the complete supported
target set.

Alternatives considered:
- **Manual only**: reduces cost, but makes every eligible `master` native change require a follow-up
  manual rebuild before release.
- **All pushes**: catches feature branches, but creates untrusted or noisy artifact candidates that
  are not needed by the release workflow.

### Narrow PR-triggered native matrix work to native-critical paths

Pull requests should not automatically build release-candidate artifacts for broad root package,
lockfile, or JavaScript package metadata changes. Those changes are already covered by CI package,
OS, affected, and native asset validation. PR native backend workflow triggers should focus on files
that directly define native artifact production: the native workflow itself, `packages/native-backend/**`,
and runtime native loader/package mapping files under `packages/impersonated-fetch/src/native/**`.

GitHub Actions `branches` and `paths` filters are conjunctive for an event, and tag pushes do not
evaluate path filters. This design intentionally stays on branch/path-filtered push and PR events,
with manual `workflow_dispatch` for release-candidate rebuilds, rather than introducing tag-path
routing.

Alternatives considered:
- **Remove PR trigger entirely**: cheapest, but hides matrix-specific failures until merge or manual
  dispatch.
- **Keep current PR paths unchanged**: maximal validation, but continues running the full matrix for
  broad dependency/package changes where CI provides faster feedback.

### Preserve the existing matrix and artifact contract for full native runs

This change is about when the workflow runs, not what a trusted full run produces. The full matrix
still includes Linux x64/x32/ARM64, macOS x64/ARM64, and Windows x64/x32/ARM64, and each job still
uploads `native-backend-${target}` containing `impersonated-fetch-backend-*` for release packaging.
If future cost pressure requires more control, job-level `if` conditions can prevent matrix fan-out
before `strategy.matrix` is evaluated, and `max-parallel` can cap concurrent runners without changing
the supported target list.

Alternatives considered:
- **Split PR and release workflows immediately**: clearer separation, but larger than the immediate
  trigger refinement and risks duplicating native setup logic.
- **Dynamic matrix generation**: possible later, but unnecessary for a static supported target list.

### Treat `ci.yml` as the general PR validation surface

`ci.yml` remains responsible for broad package and JavaScript validation: Nx affected JS checks,
host native build/test, OS build/test matrices, package validation, and native asset checks. This
keeps feedback for ordinary changes in the main CI workflow and reserves native backend artifact
matrix work for changes that affect native artifact production or explicit maintainer requests.

Alternatives considered:
- **Move all native checks out of CI**: weakens fast PR confidence for host native build/test.
- **Make native-backend.yml the only native validation**: conflates fast PR checks with release
  artifact production.

## Risks / Trade-offs

- PRs that modify root dependency metadata may no longer run the full native artifact matrix before
  merge -> CI package/OS/native-host checks still run, and maintainers can use `workflow_dispatch`
  for high-risk dependency changes.
- A path filter may miss a future native artifact input file -> keep path lists documented and update
  them when native package generation or loader mapping files move.
- Trusted `master` artifacts can still be produced from a bad merge -> release continues to require
  an explicit successful `native_run_id`, and package validation runs before publish.

## Migration Plan

1. Update `.github/workflows/native-backend.yml` path filters so `push` keeps trusted artifact input
   coverage while `pull_request` is limited to native-critical paths.
2. If needed, add job-level comments or workflow naming to clarify PR validation versus trusted
   artifact production.
3. Update native backend/release documentation to describe when to use CI, native backend dispatch,
   and release `native_run_id`.
4. Verify workflow syntax and OpenSpec validation.

Rollback: restore the previous `pull_request.paths` list in `.github/workflows/native-backend.yml`;
the matrix build and release artifact contract remain unchanged.

## Open Questions

- Should a later change split PR native validation into a smaller host/core-target job while keeping
  the current workflow as release-candidate artifact production only?
