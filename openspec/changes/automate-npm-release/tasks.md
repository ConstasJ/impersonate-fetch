## 1. Version Management

- [ ] 1.1 Add a required `workflow_dispatch` release `version` input for the first release implementation
- [ ] 1.2 Add a release step that validates the input version is legal semver, is not `0.0-development`, and is not already published for any target package
- [ ] 1.3 Add release-version validation that confirms generated backend package versions and main package pack metadata match the dispatch version

## 2. Release Workflow

- [ ] 2.1 Replace `.github/workflows/release-native-packages.yml` with `.github/workflows/release.yml`
- [ ] 2.2 Preserve workflow_dispatch inputs for `native_run_id` and license/shipping approval, and add the required manual release `version` input
- [ ] 2.3 Configure pnpm, Node.js 22, npm registry authentication, and minimal GitHub Actions permissions for npm publishing
- [ ] 2.4 Download `native-backend-*` artifacts from the provided trusted native workflow run id
- [ ] 2.5 Generate and validate native backend packages with the dispatch release version
- [ ] 2.6 Apply the dispatch version to `packages/impersonated-fetch/package.json`, then build and package-check the main package before any publish step
- [ ] 2.7 Publish all generated `@impersonated-fetch/backend-*` packages to npm before publishing `impersonated-fetch`
- [ ] 2.8 Exclude GitHub Packages publishing and tag-path routing from the release workflow

## 3. Package Tooling

- [ ] 3.1 Update native package generation or validation tooling if needed to make explicit release version injection testable
- [ ] 3.2 Add or update tests for generated native package version matching and main package optional dependency metadata
- [ ] 3.3 Add a publish-loop helper only if the workflow would otherwise duplicate package discovery logic inline

## 4. Documentation and Verification

- [ ] 4.1 Document the release flow, required `NPM_TOKEN` or npm publishing credential, `native_run_id`, and license approval input
- [ ] 4.2 Document the manual release version input workflow and note automatic version management as a follow-up option
- [ ] 4.3 Verify `pnpm run lint`, `pnpm run typecheck`, `pnpm run test:package`, and native package generation/validation checks pass
- [ ] 4.4 Dry-run or otherwise exercise the release workflow/package publish surface without publishing real packages
