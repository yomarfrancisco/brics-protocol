# Release Process

This document describes how to cut a release for the BRICS protocol.

## Overview

The BRICS protocol uses semantic versioning and conventional commits to automate release management. The release process includes:

- **Version determination**: Based on conventional commit messages
- **Changelog generation**: Automatic categorization of changes
- **Release notes**: User-friendly release documentation
- **Dry-run validation**: CI-based release preview

## Prerequisites

Before cutting a release, ensure:

1. **All tests pass**: `yarn test:unit && cd risk_api && pytest -q`
2. **Code is reviewed**: All changes have been reviewed and approved
3. **Documentation is updated**: README and docs are current
4. **CI is green**: All CI checks pass

## Local Release Process

### Step 1: Verify Environment

```bash
# Run all tests
yarn test:unit && cd risk_api && pytest -q && cd ..

# Check git status
git status

# Ensure you're on main branch
git branch --show-current
```

### Step 2: Determine Next Version

```bash
# Preview next version
yarn release:next
```

This will output something like:
```
NEXT_VERSION=0.2.0
# Version bump: minor (0.1.0 → 0.2.0)
# Commits since v0.1.0: 15
# Breaking changes: 0
# Features: 3
# Fixes: 2
```

### Step 3: Generate Release Artifacts

```bash
# Generate changelog and release notes
yarn release:notes
```

This will:
- Update `CHANGELOG.md` with a new version section
- Generate `dist/release-notes.md` for GitHub release

### Step 4: Review Generated Content

Review the generated files:

- **CHANGELOG.md**: Check that changes are properly categorized
- **dist/release-notes.md**: Verify release notes are accurate

### Step 5: Create and Push Tag

```bash
# Create tag (replace X.Y.Z with actual version)
git tag vX.Y.Z

# Push tag to remote
git push origin vX.Y.Z
```

### Step 6: Create GitHub Release

1. Go to [GitHub Releases](https://github.com/bricsprotocol/brics-protocol/releases)
2. Click "Draft a new release"
3. Select the tag you just pushed
4. Copy content from `dist/release-notes.md` to the release description
5. Publish the release

## Release Candidates

Release candidates (RC) include additional artifacts for verification:

- **Gas Report**: `gas-report.txt` - Gas usage analysis
- **Events Documentation**: `docs/CONTRACT_EVENTS.md` - Auto-generated contract events
- **Audit Bundle**: `dist/audit/audit-bundle-*.zip` - Complete audit trail with integrity checks
- **Release Notes**: `dist/release-notes.md` - Detailed release documentation

### RC Artifacts

All RC artifacts are automatically generated and uploaded by CI:

```bash
# Generate all artifacts locally
yarn audit:manifest && yarn audit:fixtures && yarn audit:tests && yarn audit:events && yarn audit:bundle

# Verify artifacts
ls -la gas-report.txt docs/CONTRACT_EVENTS.md dist/audit/audit-bundle-*.zip
```

## Dry-Run Process

### Local Dry-Run

```bash
# Run complete dry-run
yarn release:dry
```

This will:
1. Determine next version
2. Generate changelog
3. Generate release notes
4. Verify artifacts
5. Print next steps

### CI Dry-Run

The CI automatically runs a dry-run job that:

- **Triggers**: On `workflow_dispatch` or `schedule`
- **Outputs**: `CHANGELOG.md` and `dist/release-notes.md` as artifacts
- **Non-blocking**: Doesn't block the main pipeline

To access CI dry-run artifacts:

1. Go to the GitHub Actions tab
2. Find the "Release Dry-Run" job
3. Download the artifacts from the job summary

## Version Bumping Rules

The release system uses conventional commits to determine version bumps:

| Commit Type | Version Bump | Description |
|-------------|--------------|-------------|
| `feat:` | Minor | New features |
| `fix:` | Patch | Bug fixes |
| `BREAKING CHANGE` | Major | Breaking changes |
| `perf:`, `refactor:` | Patch | Performance and refactoring |
| `docs:`, `test:`, `ci:`, `chore:` | None | Documentation and maintenance |

### Examples

```bash
# Minor version bump (0.1.0 → 0.2.0)
feat: add new economics parameters
feat(governance): implement role-based access control

# Patch version bump (0.1.0 → 0.1.1)
fix: resolve gas reporting issue
fix(tests): correct InstantLane constructor calls

# Major version bump (0.1.0 → 1.0.0)
feat!: breaking change in API
fix!: BREAKING CHANGE: remove deprecated function
```

## Conventional Commit Format

All commits should follow the conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

### Types

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `ci`: CI/CD changes
- `chore`: Maintenance tasks
- `build`: Build system changes

### Scopes

Use scopes to categorize changes:

- `governance`: Governance and permissions
- `economics`: Economic parameters
- `gas`: Gas optimization
- `tests`: Test-related changes
- `docs`: Documentation changes
- `ci`: CI/CD changes

### Examples

```bash
feat(economics): add bounded parameter setters
fix(governance): correct role assignment in InstantLane
docs(release): add release process documentation
test(economics): add comprehensive parameter tests
ci(gas): add gas reporting to CI pipeline
```

## Troubleshooting

### Common Issues

1. **No conventional commits found**
   - Ensure commits follow conventional format
   - Check commit history since last tag

2. **Version determination fails**
   - Verify git repository is clean
   - Check for proper git tags

3. **Changelog generation fails**
   - Ensure CHANGELOG.md exists
   - Check for proper [Unreleased] section

4. **CI dry-run fails**
   - Check CI logs for specific errors
   - Verify all dependencies are installed

### Manual Override

If automatic versioning fails, you can manually set the version:

```bash
# Set version manually
export NEXT_VERSION=0.2.0
yarn release:notes
```

## Best Practices

1. **Regular releases**: Cut releases regularly to avoid large changelogs
2. **Clear commit messages**: Use descriptive conventional commit messages
3. **Test before release**: Always run tests before cutting a release
4. **Review changes**: Review generated changelog and release notes
5. **Document breaking changes**: Clearly document any breaking changes

## Future Enhancements

- **Automated releases**: GitHub Actions-based automated releases
- **Release validation**: Additional checks before release
- **Release templates**: Customizable release note templates
- **Version management**: Automated version bumping in package.json

