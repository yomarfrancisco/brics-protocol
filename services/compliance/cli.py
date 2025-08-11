"""
BRICS Compliance Service CLI
"""
import argparse
import json
import sys
import os
from typing import Dict, Any

try:
    from .app import app
    from .schemas import KYCRequest, AMLRequest
    from .adapters.mock_provider import MockComplianceProvider
except ImportError:
    # Allow running as script
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from services.compliance.app import app
    from services.compliance.schemas import KYCRequest, AMLRequest
    from services.compliance.adapters.mock_provider import MockComplianceProvider

def kyc_command(args):
    """Handle the KYC command"""
    subject_id = args.subject
    
    # Create request data
    request_data = {"subjectId": subject_id}
    
    # Add optional fields
    if args.name:
        request_data["name"] = args.name
    if args.dob:
        request_data["dob"] = args.dob
    if args.doc_type:
        request_data["docType"] = args.doc_type
    if args.doc_last4:
        request_data["docLast4"] = args.doc_last4
    
    # Create request object
    request = KYCRequest(**request_data)
    
    # Initialize provider
    seed = os.getenv('SEED', '')
    provider = MockComplianceProvider(seed=seed)
    
    # Perform KYC check
    result = provider.check_kyc(
        subject_id=request.subjectId,
        name=request.name,
        dob=request.dob,
        docType=request.docType,
        docLast4=request.docLast4
    )
    
    # Print result
    if getattr(args, 'json_only', False):
        print(json.dumps(result))
    else:
        print(f"KYC Check for subject: {subject_id}")
        print(f"Status: {result['status']}")
        print(f"Confidence: {result['confidence']}")
        print(f"Reasons: {', '.join(result['reasons'])}")
        print(f"Timestamp: {result['timestamp']}")
        print(f"\nJSON Output:")
        print(json.dumps(result, indent=2))

def aml_command(args):
    """Handle the AML command"""
    subject_id = args.subject
    
    # Create request object
    request = AMLRequest(subjectId=subject_id)
    
    # Initialize provider
    seed = os.getenv('SEED', '')
    provider = MockComplianceProvider(seed=seed)
    
    # Perform AML screening
    result = provider.screen_aml(subject_id=request.subjectId)
    
    # Print result
    if getattr(args, 'json_only', False):
        print(json.dumps(result))
    else:
        print(f"AML Screening for subject: {subject_id}")
        print(f"Status: {result['status']}")
        print(f"Score: {result['score']}")
        print(f"Lists: {', '.join(result['lists'])}")
        print(f"Timestamp: {result['timestamp']}")
        print(f"\nJSON Output:")
        print(json.dumps(result, indent=2))

def main():
    parser = argparse.ArgumentParser(description="BRICS Compliance Service CLI")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # KYC command
    kyc_parser = subparsers.add_parser("kyc", help="Perform KYC check")
    kyc_parser.add_argument("--subject", "-s", required=True, help="Subject ID")
    kyc_parser.add_argument("--name", "-n", help="Full name")
    kyc_parser.add_argument("--dob", "-d", help="Date of birth (YYYY-MM-DD)")
    kyc_parser.add_argument("--doc-type", "-t", choices=["passport", "drivers_license", "national_id"], help="Document type")
    kyc_parser.add_argument("--doc-last4", "-l", help="Last 4 digits of document")
    kyc_parser.add_argument("--json-only", action="store_true", help="Output only JSON")
    kyc_parser.set_defaults(func=kyc_command)
    
    # AML command
    aml_parser = subparsers.add_parser("aml", help="Perform AML screening")
    aml_parser.add_argument("--subject", "-s", required=True, help="Subject ID")
    aml_parser.add_argument("--json-only", action="store_true", help="Output only JSON")
    aml_parser.set_defaults(func=aml_command)
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    args.func(args)

if __name__ == "__main__":
    main()
