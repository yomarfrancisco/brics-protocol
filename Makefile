SHELL := /bin/bash
.ONESHELL:
.SILENT:

.PHONY: bootstrap e2e-replay clean

bootstrap:
	# fresh clone bootstrap (CI and local)
	corepack enable
	yarn install --frozen-lockfile
	# add any build steps here (tsc, typechain, etc.)
	yarn build || true

e2e-replay:
	PRICING_PROVIDER=replay BANK_DATA_MODE=off yarn test tests/replay/cds-swap.e2e-replay.spec.ts

clean:
	git clean -xfd
