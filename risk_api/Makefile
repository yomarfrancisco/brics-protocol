# BRICS Risk API Makefile
# Development, testing, and deployment targets

.PHONY: help install dev test lint docker-build docker-run clean

# Default target
help:
	@echo "BRICS Risk API - Available targets:"
	@echo "  install     - Install dependencies"
	@echo "  dev         - Run development server with reload"
	@echo "  test        - Run test suite"
	@echo "  lint        - Run linting and formatting"
	@echo "  docker-build - Build Docker image"
	@echo "  docker-run  - Run Docker container"
	@echo "  clean       - Clean build artifacts"

# Install dependencies
install:
	pip install -e ".[dev]"

# Run development server
dev:
	uvicorn risk_api.app:app --host 0.0.0.0 --port 8000 --reload

# Run tests
test:
	pytest -v

# Run tests with coverage
test-cov:
	pytest --cov=risk_api --cov-report=html --cov-report=term

# Run linting and formatting
lint:
	black risk_api/
	isort risk_api/
	mypy risk_api/

# Build Docker image
docker-build:
	docker build -t brics-risk-api:latest .

# Run Docker container
docker-run:
	docker run -p 8000:8000 --env-file env.example brics-risk-api:latest

# Clean build artifacts
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.pyd" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".mypy_cache" -exec rm -rf {} +
	find . -type d -name "htmlcov" -exec rm -rf {} +
	find . -type f -name ".coverage" -delete
