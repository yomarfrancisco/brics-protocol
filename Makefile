.PHONY: bootstrap test e2e-replay pricing:serve

bootstrap:
	@echo "🔧 Setting up development environment..."
	corepack enable
	yarn install
	@echo "🐍 Setting up Python environments..."
	cd services/pricing && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
	cd services/compliance && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
	@if command -v pre-commit >/dev/null 2>&1; then \
		echo "📝 Installing pre-commit hooks..."; \
		pre-commit install; \
	else \
		echo "⚠️  pre-commit not found, skipping hooks installation"; \
	fi
	@echo "✅ Bootstrap complete!"

test:
	@echo "🧪 Running tests..."
	yarn test

e2e-replay:
	@echo "🎯 Running E2E replay demo..."
	PRICING_PROVIDER=replay BANK_DATA_MODE=off yarn hardhat swap:demo --obligor ACME-LLC --tenor 30 --asof $(shell node -e 'console.log(Math.floor(Date.now()/1000)-120)') --notional 1000000 --fixed-spread 80

pricing:serve:
	@echo "🚀 Starting pricing service..."
	cd services/pricing && source venv/bin/activate && uvicorn services.pricing.app:app --port 8001
