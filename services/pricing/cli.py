#!/usr/bin/env python3
"""
BRICS Pricing Service CLI
"""
import argparse
import json
import sys
import time
from typing import Dict, Any

from baseline_model import score_risk, price_cds, generate_dummy_digest, generate_dummy_signature

def create_sample_features() -> Dict[str, Any]:
    """Create sample features for testing"""
    return {
        "size": 0.5,
        "leverage": 0.3,
        "volatility": 0.4,
        "fxExposure": 0.2,
        "countryRisk": 0.1,
        "industryStress": 0.2,
        "collateralQuality": 0.7,
        "dataQuality": 0.8,
        "modelShift": 0.1
    }

def price_command(args):
    """Handle the price command"""
    obligor_id = args.obligor
    tenor_days = args.tenor
    notional = args.notional
    
    # Parse asof
    if args.asof == "now":
        as_of = int(time.time())
    else:
        try:
            as_of = int(args.asof)
        except ValueError:
            print(f"Error: Invalid asof value '{args.asof}'. Use 'now' or unix timestamp.")
            sys.exit(1)
    
    # Use provided features or defaults
    if args.features:
        try:
            features = json.loads(args.features)
        except json.JSONDecodeError:
            print(f"Error: Invalid JSON in features '{args.features}'")
            sys.exit(1)
    else:
        features = create_sample_features()
    
    print(f"Pricing CDS for obligor: {obligor_id}")
    print(f"Tenor: {tenor_days} days")
    print(f"Notional: {notional:,}")
    print(f"As of: {as_of}")
    print(f"Features: {json.dumps(features, indent=2)}")
    print("-" * 50)
    
    # Score the risk
    score_result = score_risk(features, obligor_id)
    print(f"Risk Score:")
    print(f"  PD: {score_result['pdBps']} bps")
    print(f"  LGD: {score_result['lgdBps']} bps")
    print(f"  Confidence: {score_result['scoreConfidence']}")
    
    # Price the CDS
    price_result = price_cds(obligor_id, tenor_days, features, 
                           score_result['pdBps'], score_result['lgdBps'])
    
    print(f"\nCDS Pricing:")
    print(f"  Fair Spread: {price_result['fairSpreadBps']} bps")
    print(f"  Correlation: {price_result['correlationBps']} bps")
    print(f"  Expected Loss: {price_result['elBps']} bps")
    
    # Generate dummy digest and signature
    digest = generate_dummy_digest(obligor_id, as_of)
    signature = generate_dummy_signature(obligor_id, as_of)
    
    print(f"\nDigest: {digest}")
    print(f"Signature: {signature}")
    
    # Calculate annual premium
    annual_premium = (notional * price_result['fairSpreadBps']) // 10000
    print(f"\nAnnual Premium: ${annual_premium:,}")

def score_command(args):
    """Handle the score command"""
    obligor_id = args.obligor
    tenor_days = args.tenor
    
    # Parse asof
    if args.asof == "now":
        as_of = int(time.time())
    else:
        try:
            as_of = int(args.asof)
        except ValueError:
            print(f"Error: Invalid asof value '{args.asof}'. Use 'now' or unix timestamp.")
            sys.exit(1)
    
    # Use provided features or defaults
    if args.features:
        try:
            features = json.loads(args.features)
        except json.JSONDecodeError:
            print(f"Error: Invalid JSON in features '{args.features}'")
            sys.exit(1)
    else:
        features = create_sample_features()
    
    print(f"Scoring risk for obligor: {obligor_id}")
    print(f"Tenor: {tenor_days} days")
    print(f"As of: {as_of}")
    print(f"Features: {json.dumps(features, indent=2)}")
    print("-" * 50)
    
    # Score the risk
    score_result = score_risk(features, obligor_id)
    
    print(f"Risk Score Results:")
    print(f"  PD: {score_result['pdBps']} bps")
    print(f"  LGD: {score_result['lgdBps']} bps")
    print(f"  Confidence: {score_result['scoreConfidence']}")

def main():
    parser = argparse.ArgumentParser(description="BRICS Pricing Service CLI")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Price command
    price_parser = subparsers.add_parser("price", help="Price a CDS")
    price_parser.add_argument("--obligor", "-o", required=True, help="Obligor ID")
    price_parser.add_argument("--tenor", "-t", type=int, default=365, help="Tenor in days")
    price_parser.add_argument("--asof", "-a", default="now", help="As of time (now or unix timestamp)")
    price_parser.add_argument("--notional", "-n", type=int, required=True, help="Notional amount")
    price_parser.add_argument("--features", "-f", help="JSON features object")
    price_parser.set_defaults(func=price_command)
    
    # Score command
    score_parser = subparsers.add_parser("score", help="Score risk for an obligor")
    score_parser.add_argument("--obligor", "-o", required=True, help="Obligor ID")
    score_parser.add_argument("--tenor", "-t", type=int, default=365, help="Tenor in days")
    score_parser.add_argument("--asof", "-a", default="now", help="As of time (now or unix timestamp)")
    score_parser.add_argument("--features", "-f", help="JSON features object")
    score_parser.set_defaults(func=score_command)
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    args.func(args)

if __name__ == "__main__":
    main()
