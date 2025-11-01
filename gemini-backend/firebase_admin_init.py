import json
import logging
import os
from typing import Optional

import firebase_admin
from firebase_admin import auth, credentials, firestore, db as admin_db

logger = logging.getLogger(__name__)


def _load_credentials() -> credentials.Certificate:
    """Load Firebase service account credentials from env or local file."""
    key_path = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY_PATH')
    key_json = os.environ.get('FIREBASE_SERVICE_ACCOUNT_KEY')

    if key_path and os.path.exists(key_path):
        logger.info("Using Firebase service account key from FIREBASE_SERVICE_ACCOUNT_KEY_PATH.")
        return credentials.Certificate(key_path)

    if key_json:
        logger.info("Using Firebase service account key from FIREBASE_SERVICE_ACCOUNT_KEY environment variable.")
        return credentials.Certificate(json.loads(key_json))

    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    default_path = os.path.join(repo_root, 'serviceAccountKey.json')
    if os.path.exists(default_path):
        logger.info("Using Firebase service account key from serviceAccountKey.json.")
        return credentials.Certificate(default_path)

    raise FileNotFoundError(
        "Firebase service account credentials not found. "
        "Set FIREBASE_SERVICE_ACCOUNT_KEY_PATH, FIREBASE_SERVICE_ACCOUNT_KEY, "
        "or provide serviceAccountKey.json at the repo root."
    )


def _initialize_app() -> firebase_admin.App:
    if firebase_admin._apps:
        return firebase_admin.get_app()

    firebase_options = {}
    database_url = os.environ.get('FIREBASE_DATABASE_URL')
    if database_url:
        firebase_options['databaseURL'] = database_url

    credentials_cert = _load_credentials()
    logger.info("Initializing Firebase Admin SDK.")
    return firebase_admin.initialize_app(credentials_cert, firebase_options or None)


firebase_app = _initialize_app()


def get_firestore_client() -> firestore.Client:
    if not firebase_admin._apps:
        _initialize_app()
    return firestore.client()


def get_rtdb_root():
    if not firebase_admin._apps:
        _initialize_app()
    database_url_env = os.environ.get('FIREBASE_DATABASE_URL')
    return admin_db.reference('/') if database_url_env else None


db = get_firestore_client()

database_url_env = os.environ.get('FIREBASE_DATABASE_URL')
rtdb = get_rtdb_root()


def verify_id_token(id_token: str) -> Optional[dict]:
    try:
        return auth.verify_id_token(id_token)
    except Exception as exc:
        logger.error(f"Error verifying Firebase ID token: {exc}")
        return None


def get_user_data(user_id: str) -> Optional[dict]:
    try:
        doc = db.collection('users').document(user_id).get()
        if doc.exists:
            return doc.to_dict()
        return None
    except Exception as exc:
        logger.error(f"Error fetching user data for {user_id}: {exc}")
        return None
