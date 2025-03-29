import firebase_admin
from firebase_admin import credentials, auth, firestore
import os

# Get absolute path to the service account file
current_dir = os.path.dirname(os.path.abspath(__file__))
service_account_path = os.path.join(os.path.dirname(current_dir), 'serviceAccountKey.json')

# Initialize Firebase Admin with service account
cred = credentials.Certificate(service_account_path)
firebase_app = firebase_admin.initialize_app(cred)

# Initialize Firestore DB
db = firestore.client()

def verify_id_token(id_token):
    """
    Verify a Firebase ID token and return the decoded token
    """
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        print(f"Error verifying token: {e}")
        return None

def get_user_data(user_id):
    """
    Get user data from Firestore
    """
    try:
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        
        if user_doc.exists:
            return user_doc.to_dict()
        return None
    except Exception as e:
        print(f"Error getting user data: {e}")
        return None 