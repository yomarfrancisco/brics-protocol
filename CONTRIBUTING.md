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

## Reproducing a Replay Locally

```bash
corepack enable
corepack prepare yarn@4.9.2 --activate
yarn install --immutable

Set signer (optional; helpers will safely fallback if unset):

export CI_SIGNER_PRIVKEY=0x...   # never commit or echo this

Verify fixtures:

yarn fixtures:hashcheck

Run replay:

PRICING_PROVIDER=replay BANK_DATA_MODE=off yarn test -g "replay"
# or:
scripts/repro/replay.sh

Deterministic fixtures (CI):

FIXTURE_SEED=42 yarn fixtures:freeze

Artifacts from CI (replay-artifacts-<run_id>) include fixtures, build artifacts, and REPRO.md.
We never log private keys; helpers validate env and fall back safely.

## USDC Funding in Tests

Our test suite uses **MockUSDC** (mintable) in local/CI runs and optionally a **whale** address on mainnet forks.

- The helper `test/utils/fundUSDC.ts` exposes:
  - `fundUSDC(usdc, [recipients], { amount? })` → unified entry point.
  - On local/mock it calls `mint(address,uint256)` directly (fast & deterministic).
  - On a fork, set `USDC_WHALE=0x...` to fund via whale transfers.
  - You can force the mint path with `{ forceMint: true }`.

**Who needs USDC?**
- **Lane** contracts need USDC to pass to AMM/PMM.
- **AMM/PMM mocks** need USDC reserves to pay out to the member.
- Some specs additionally fund the **member** for balance assertions.

**Example usage in a spec:**
```ts
import { fundUSDC } from "../utils/fundUSDC";
await fundUSDC(usdc, [lane, amm, member], { amount: 2_000_000n * 10n**6n });
```

On forks, export a whale address:
```bash
export USDC_WHALE=0xYourRichUSDCAccount
```

To keep tests isolated and fast, many specs use Hardhat snapshots to revert after each test.

#### Updating Replay Fixture
To update the Replay fixture:
1. Set `export CI_SIGNER_PRIVKEY=<your-fixed-key>`
2. Run `yarn fixtures:freeze && yarn fixtures:hashcheck`
3. Commit BOTH: `pricing-fixtures/ACME-LLC-30-frozen.json` and `.sha256`
4. **Include rationale** in PR description for why fixture was updated
5. **Do NOT modify frozen fixture in PRs** unless intentionally regenerating

#### Fixture Staleness
- **30-day guard**: CI fails if frozen fixture is older than 30 days
- **Weekly auto-rotation**: Automated PRs created every Monday at 02:00 UTC
- **Manual refresh**: Use the following commands:
  ```bash
  export CI_SIGNER_PRIVKEY=<fixed key>
  yarn hardhat run scripts/fixtures/generate.ts
  yarn ts-node scripts/freeze-fixture.ts
  yarn fixtures:hashcheck
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
