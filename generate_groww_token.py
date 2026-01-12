import hashlib
import time
import requests
import json

def generate_checksum(secret: str, timestamp: str) -> str:
    """Generate SHA-256 checksum"""
    input_str = secret + timestamp
    sha256 = hashlib.sha256()
    sha256.update(input_str.encode('utf-8'))
    return sha256.hexdigest()

def get_access_token(api_key: str, api_secret: str):
    """Generate and retrieve access token"""
    timestamp = str(int(time.time()))
    checksum = generate_checksum(api_secret, timestamp)
    
    url = "https://api.groww.in/v1/token/api/access"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "key_type": "approval",
        "checksum": checksum,
        "timestamp": timestamp
    }
    
    print("=" * 60)
    print("GENERATING GROWW API ACCESS TOKEN")
    print("=" * 60)
    print(f"Timestamp: {timestamp}")
    print(f"Checksum: {checksum}")
    print("\nSending request to Groww API...")
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code == 200:
            data = response.json()
            print("\n✅ SUCCESS! Access token generated.")
            print("=" * 60)
            print(f"Token: {data['token']}")
            print(f"Expires: {data['expiry']}")
            print(f"Status: {'Active' if data['active'] else 'Inactive'}")
            print("=" * 60)
            
            # Save to file
            with open('current_access_token.txt', 'w') as f:
                f.write(f"Access Token (Generated at {time.strftime('%Y-%m-%d %H:%M:%S')})\n")
                f.write("=" * 60 + "\n")
                f.write(f"{data['token']}\n")
                f.write("=" * 60 + "\n")
                f.write(f"Expires: {data['expiry']}\n")
            
            print("\n💾 Token saved to 'current_access_token.txt'")
            return data['token']
        else:
            print(f"\n❌ ERROR: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        return None

# Your credentials
API_KEY = "eyJraWQiOiJaTUtjVXciLCJhbGciOiJFUzI1NiJ9.eyJleHAiOjI1NTYzNzc5NzcsImlhdCI6MTc2Nzk3Nzk3NywibmJmIjoxNzY3OTc3OTc3LCJzdWIiOiJ7XCJ0b2tlblJlZklkXCI6XCIwYjFjNzlkOC1lZmRhLTRmOTEtOWY3MC1lNjc0OWRiNTRhZmNcIixcInZlbmRvckludGVncmF0aW9uS2V5XCI6XCJlMzFmZjIzYjA4NmI0MDZjODg3NGIyZjZkODQ5NTMxM1wiLFwidXNlckFjY291bnRJZFwiOlwiZDc2M2FkMjAtYjRhOC00MTlmLWIxMWEtYjMyYThmNTVmN2UxXCIsXCJkZXZpY2VJZFwiOlwiYmFlYmVlNjEtZTBlZi01M2JiLTk5MWQtMmI4MGZjZDY2ZTM3XCIsXCJzZXNzaW9uSWRcIjpcIjE5ODU2MTY4LTBmNzUtNDg5OS04ZTAxLTQ2MTMxOWRhY2E1MVwiLFwiYWRkaXRpb25hbERhdGFcIjpcIno1NC9NZzltdjE2WXdmb0gvS0EwYk1CaWdHZEtrTnI3UVRyOTNMc29EVDVSTkczdTlLa2pWZDNoWjU1ZStNZERhWXBOVi9UOUxIRmtQejFFQisybTdRPT1cIixcInJvbGVcIjpcImF1dGgtdG90cFwiLFwic291cmNlSXBBZGRyZXNzXCI6XCIyNDA1OjIwMTpjNDAzOjE4YmU6NTVjYjo4ZDkwOjVjYTY6YjE1OSwxNzIuNzAuMTkyLjEzNSwzNS4yNDEuMjMuMTIzXCIsXCJ0d29GYUV4cGlyeVRzXCI6MjU1NjM3Nzk3NzI3NX0iLCJpc3MiOiJhcGV4LWF1dGgtcHJvZC1hcHAifQ.bMnH_cxGbqdJadkwiRGK_4EBNLEBu4nDgIgtHz7OTnqEyl6kUGfXEvH9CbOyVzVhrMi_aNpaSUdvMzhdBF9x1g"
API_SECRET = "gIDb_nFKZ*D@Up8N)YsM*@OaTE2xD5EU"

if __name__ == "__main__":
    token = get_access_token(API_KEY, API_SECRET)
    
    if token:
        print("\n📝 QUICK REFERENCE - Copy this token for API calls:")
        print("-" * 60)
        print(token)
        print("-" * 60)