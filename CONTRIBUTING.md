# Contributing to BRICS Protocol

Thank you for your interest in contributing to BRICS Protocol! This document outlines the development process and standards.

## Development Setup

```bash
make bootstrap
```

This sets up the complete development environment including Node.js, Python services, and pre-commit hooks.

## Commit Style

We follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes
- `build`: Build system changes

### Examples
```
feat(swap): add CDS swap lifecycle management
fix(pricing): correct signature verification
docs: update quickstart guide
ci: add smoke test job
```

## Pull Request Guidelines

### Size
- Keep PRs small and focused on a single feature/fix
- Aim for <500 lines of changes
- Break large features into multiple PRs

### Requirements
- All tests must pass: `make test`
- E2E replay must work: `make e2e-replay`
- No linting errors
- Documentation updated if needed

### Process
1. Create a feature branch from `main`
2. Make your changes with small, focused commits
3. Ensure all tests pass locally
4. Update documentation if needed
5. Create a PR with clear description
6. Wait for CI checks to pass
7. Request review if needed

## Testing Requirements

### Required Tests
- Unit tests for all new functionality
- Integration tests for contract interactions
- E2E tests for complete workflows
- Parity tests for off-chain/on-chain consistency

### Test Commands
```bash
make test              # Run all tests
make e2e-replay        # Run E2E replay demo
yarn test --grep "CDS" # Run specific test suite
```

### Replay E2E Determinism

The Replay E2E tests use deterministic fixtures and signers for consistent results:

#### Local Development
- Uses fixed test key from `test/utils/signers.ts`
- Loads frozen fixture from `pricing-fixtures/ACME-LLC-30-frozen.json`
- No runtime fixture regeneration

#### CI Environment  
- Uses `CI_SIGNER_PRIVKEY` from GitHub Secrets
- Same frozen fixture for consistency
- Non-blocking job with `continue-on-error: true`

#### Important Notes
- **Do not regenerate frozen fixtures** in PRs
- **Do not modify the fixed test key** in `test/utils/signers.ts`
- **Replay tests must pass locally** before submitting PRs
- **CI signer is pinned** for deterministic results

#### Updating Replay Fixture
To update the Replay fixture:
1. Set `export CI_SIGNER_PRIVKEY=<your-fixed-key>`
2. Run `yarn fixtures:freeze && yarn fixtures:hashcheck`
3. Commit BOTH: `pricing-fixtures/ACME-LLC-30-frozen.json` and `.sha256`
4. **Include rationale** in PR description for why fixture was updated
5. **Do NOT modify frozen fixture in PRs** unless intentionally regenerating

## Code Standards

### Solidity
- Use OpenZeppelin contracts where possible
- Follow Solidity style guide
- Add NatSpec comments for public functions
- Use custom errors for gas optimization

### TypeScript/JavaScript
- Use TypeScript for all new code
- Follow ESLint configuration
- Add JSDoc comments for public APIs

### Python
- Follow PEP 8 style guide
- Add type hints
- Include docstrings for functions

## Security

- No bank data integrations by default
- All external calls use SafeERC20
- Reentrancy guards on critical paths
- Role-based access control

## Questions?

Feel free to open an issue for questions about contributing or development setup.
