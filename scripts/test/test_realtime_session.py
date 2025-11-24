import os
import django
from django.conf import settings

# Setup Django environment
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from core.clients import create_realtime_session, APIClientError

def test_session():
    print("Testing Realtime Session Creation...")
    try:
        session = create_realtime_session()
        print("✅ Session created successfully!")
        print(f"Session ID: {session.get('id', 'N/A')}")
        print(f"Client Secret: {session.get('client_secret', {}).get('value', 'N/A')}")
    except APIClientError as e:
        print(f"❌ Failed to create session: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    test_session()
