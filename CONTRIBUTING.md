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
