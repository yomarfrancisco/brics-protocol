# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1.0 | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please follow these steps:

### 1. **DO NOT** create a public GitHub issue
Security vulnerabilities should be reported privately to prevent exploitation.

### 2. **Email us directly**
Send details to: security@brics-protocol.com

### 3. **Include the following information**
- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Suggested fix (if any)
- Your contact information

### 4. **Response timeline**
- **Initial response**: Within 48 hours
- **Status update**: Within 7 days
- **Resolution**: As quickly as possible

## Security Features

### Bank Data Protection
- **BANK_DATA_MODE=off by default**: No bank data access unless explicitly enabled
- **Explicit opt-in required**: Must set `BANK_DATA_MODE=live` for production bank integrations
- **Provider fencing**: Bank provider throws error unless explicitly enabled
- **CI safety**: All CI jobs run with bank data disabled

### Smart Contract Security
- **SafeERC20**: All token transfers use OpenZeppelin's SafeERC20
- **Reentrancy guards**: Critical paths protected against reentrancy attacks
- **Role-based access control**: Fine-grained permissions with OpenZeppelin AccessControl
- **Custom errors**: Gas-optimized error handling
- **Static analysis**: Slither integration in CI

### Signature Verification
- **EIP-191 compliance**: All signatures follow Ethereum standard
- **Oracle verification**: On-chain verification of off-chain signatures
- **Parity testing**: Off-chain vs on-chain digest verification
- **Deterministic signing**: Reproducible signatures for testing

## Security Best Practices

### For Developers
1. **Never commit private keys** or sensitive data
2. **Use environment variables** for configuration
3. **Test with mock data** in development
4. **Enable bank data only** when absolutely necessary
5. **Review all external calls** for security implications

### For Users
1. **Verify contract addresses** before interactions
2. **Use hardware wallets** for large transactions
3. **Review transaction data** before signing
4. **Report suspicious activity** immediately

## Audit Status

- **v0.1.0-rc1**: Internal security review completed
- **v0.1.0**: External audit planned

## Responsible Disclosure

We follow responsible disclosure practices:
- Vulnerabilities are fixed before public disclosure
- Credit is given to reporters in security advisories
- Coordinated disclosure with affected parties

## Security Contacts

- **Security Team**: security@brics-protocol.com
- **Emergency**: For critical issues, include "URGENT" in subject line

## Bug Bounty

We do not currently offer a formal bug bounty program, but we appreciate security researchers who follow responsible disclosure practices.
