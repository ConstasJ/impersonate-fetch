## 1. Workflow Trigger Refinement

- [ ] 1.1 Update `.github/workflows/native-backend.yml` so `push` keeps trusted `master` artifact input path coverage while `pull_request` is limited to native-critical paths
- [ ] 1.2 Preserve `workflow_dispatch`, the existing eight-target matrix, per-platform setup, and `native-backend-${{ matrix.target }}` artifact upload behavior
- [ ] 1.3 Confirm root package metadata and lockfile-only pull requests rely on `.github/workflows/ci.yml` validation rather than automatically triggering the full native backend matrix

## 2. Documentation

- [ ] 2.1 Update native backend or release documentation to explain the distinction between CI validation, native backend trusted artifact production, and release `native_run_id` consumption
- [ ] 2.2 Document when maintainers should use manual `workflow_dispatch` for high-risk dependency or release-candidate rebuilds

## 3. Verification

- [ ] 3.1 Validate GitHub Actions workflow syntax for `.github/workflows/native-backend.yml`
- [ ] 3.2 Run OpenSpec validation for `refine-native-backend-workflow-triggers`
- [ ] 3.3 Inspect the final trigger path lists and confirm they match the updated specs and design
