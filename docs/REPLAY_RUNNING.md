# Running Replay Tests

## Standard Run
```bash
yarn test:replay
```

## Deterministic Settings
The replay tests use deterministic Hardhat configuration:
- `chainId: 31337`
- `initialBaseFeePerGas: 0`
- `gasPrice: 'auto'`
- Deterministic mining (no randomness)

## Troubleshooting

### If tests are flaky:
```bash
# Run without parallel execution
yarn hardhat test tests/replay/**/*.spec.ts --no-parallel
```

### If fixture is stale:
```bash
export CI_SIGNER_PRIVKEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
yarn fixtures:freeze
yarn test:replay
```

### If time-related issues:
```bash
# Clear Hardhat cache
rm -rf cache/
yarn test:replay
```

## CI Integration
- Replay tests run in CI with pinned signer
- Fixture staleness checked (>30 days fails)
- Hash integrity verified automatically
