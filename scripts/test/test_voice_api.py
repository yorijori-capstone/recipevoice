import requests
import json

BASE_URL = "http://localhost:8012/api/recipes/voice/control/"

def test_start_guidance():
    recipe_id = "rec-8bad47c2555e"
    payload = {
        "action": "start",
        "recipe_id": recipe_id
    }
    
    print(f"Sending request to {BASE_URL} with payload: {payload}")
    try:
        response = requests.post(BASE_URL, json=payload)
        if not response.ok:
            print(f"Error Response: {response.text}")
        response.raise_for_status()
        data = response.json()
        
        print("Response received:")
        print(f"Text to speak: {data.get('text')}")
        print(f"Steps count: {len(data.get('steps', []))}")
        print(f"Current step index: {data.get('current_step_index')}")
        
        if len(data.get('steps', [])) > 0:
            print("API Verification SUCCESS")
        else:
            print("API Verification FAILED: No steps returned")
            
    except Exception as e:
        print(f"API Verification FAILED: {e}")
        if hasattr(e, 'response') and e.response:
            print(f"Response content: {e.response.text}")

if __name__ == "__main__":
    test_start_guidance()
