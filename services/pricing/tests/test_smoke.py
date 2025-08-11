import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import health

def test_health_endpoint():
    """Test that the health endpoint returns expected response"""
    response = health()
    assert response["ok"] is True
    assert "oracle" in response
    print("Health endpoint test passed")

def test_app_import():
    """Test that the app module can be imported"""
    import app
    assert hasattr(app, 'app')
    assert hasattr(app, 'health')
    print("App import test passed")

if __name__ == "__main__":
    test_health_endpoint()
    test_app_import()
    print("All smoke tests passed!")
