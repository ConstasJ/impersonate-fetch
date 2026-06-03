## MODIFIED Requirements

### Requirement: Graph-aware task orchestration
The monorepo SHALL use Nx task orchestration for build, test, lint, typecheck, Go build/test, native package generation, and package validation targets, and GitHub Actions workflow triggers SHALL keep JavaScript/package validation separate from trusted native artifact matrix production.

#### Scenario: Affected tasks run
- **WHEN** CI runs affected checks for a change touching only JavaScript package files
- **THEN** Nx runs the affected JavaScript targets without unnecessarily rebuilding unrelated native artifacts

#### Scenario: Native changes trigger dependent checks
- **WHEN** CI runs affected checks for a change touching Go backend source or native package generation tools
- **THEN** Nx runs the relevant Go backend build/test targets and dependent package validation targets

#### Scenario: Native artifact workflow is reserved for native artifact inputs
- **WHEN** pull request workflow filters are evaluated for the native backend artifact matrix workflow
- **THEN** changes that do not affect native backend source, native artifact workflow logic, or runtime native artifact resolution are validated by CI without automatically requiring the full native backend artifact matrix workflow

#### Scenario: Cache outputs are declared
- **WHEN** Nx runs cacheable build targets
- **THEN** JavaScript build output, Go build output, and generated native package artifacts use declared output paths suitable for local and CI caching
