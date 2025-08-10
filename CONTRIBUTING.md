# Contributing to BRICS Protocol

Thank you for your interest in contributing to BRICS Protocol! This document provides guidelines for contributing to the project.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a feature branch** for your changes
4. **Make your changes** following the guidelines below
5. **Test your changes** thoroughly
6. **Submit a pull request**

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/brics-protocol.git
cd brics-protocol

# Install dependencies
npm ci

# Build contracts
npm run build

# Run tests
npm test
```

## Code Style Guidelines

### Solidity
- Follow the [Solidity Style Guide](https://docs.soliditylang.org/en/v0.8.24/style-guide.html)
- Use 4 spaces for indentation
- Maximum line length of 120 characters
- Use descriptive variable and function names
- Add comprehensive NatSpec comments for public functions

### TypeScript/JavaScript
- Use 2 spaces for indentation
- Maximum line length of 100 characters
- Use TypeScript for all new code
- Follow ESLint configuration
- Use descriptive variable and function names

### General
- Write clear, descriptive commit messages
- Keep commits focused and atomic
- Add tests for new functionality
- Update documentation as needed

## Testing

- Write unit tests for all new functionality
- Ensure all existing tests pass
- Test on multiple networks (localhost, sepolia)
- Test emergency scenarios and edge cases

## Pull Request Process

1. **Update documentation** if needed
2. **Add tests** for new functionality
3. **Ensure all tests pass** locally
4. **Update the CHANGELOG.md** with your changes
5. **Submit the PR** with a clear description

## Issue Reporting

When reporting issues, please include:

- **Environment details** (OS, Node.js version, etc.)
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Screenshots or logs** if applicable
- **Code examples** if relevant

## Security

- **Never commit private keys** or sensitive data
- **Report security vulnerabilities** privately (see SECURITY.md)
- **Follow security best practices** in your code

## Questions?

If you have questions about contributing, please:

1. Check the existing documentation
2. Search existing issues and discussions
3. Create a new issue with the "question" label

Thank you for contributing to BRICS Protocol!
