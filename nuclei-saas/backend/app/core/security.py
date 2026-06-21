import base64
import json
import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    subject: str,
    extra_claims: Optional[dict[str, Any]] = None,
) -> str:
    expire = datetime.now(tz=timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload: dict[str, Any] = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.now(tz=timezone.utc),
        "type": "access",
        "jti": str(uuid.uuid4()),
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: str) -> str:
    expire = datetime.now(tz=timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload: dict[str, Any] = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.now(tz=timezone.utc),
        "type": "refresh",
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError as exc:
        raise ValueError(f"Invalid token: {exc}") from exc


def generate_api_key() -> str:
    alphabet = string.ascii_letters + string.digits
    token = "".join(secrets.choice(alphabet) for _ in range(48))
    return f"lc_{token}"


def generate_secure_token(length: int = 32) -> str:
    return secrets.token_urlsafe(length)


def _get_fernet() -> Fernet:
    key = settings.FIELD_ENCRYPTION_KEY
    # If the key looks like a raw string (not proper Fernet key), derive one
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except Exception:
        # Derive a 32-byte key from the string and base64-encode it
        import hashlib

        derived = base64.urlsafe_b64encode(
            hashlib.sha256(key.encode()).digest()
        )
        return Fernet(derived)


def encrypt_data(data: dict | str) -> str:
    """Encrypt a dict or string using Fernet symmetric encryption.

    Returns a base64-encoded encrypted string safe for database storage.
    """
    fernet = _get_fernet()
    if isinstance(data, dict):
        plaintext = json.dumps(data).encode()
    else:
        plaintext = data.encode()
    return fernet.encrypt(plaintext).decode()


def decrypt_data(encrypted: str) -> dict | str:
    """Decrypt a Fernet-encrypted string.

    Returns parsed JSON dict if the decrypted content is valid JSON,
    otherwise returns the raw decrypted string.
    """
    fernet = _get_fernet()
    try:
        plaintext = fernet.decrypt(encrypted.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Failed to decrypt data: invalid token or key") from exc

    try:
        return json.loads(plaintext)
    except json.JSONDecodeError:
        return plaintext
