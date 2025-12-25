"""
Token Encryption Utilities

Provides secure encryption/decryption for OAuth tokens using Fernet symmetric encryption.
"""

from cryptography.fernet import Fernet
from app.core.config import settings


def encrypt_token(token: str) -> str:
    """
    Encrypt OAuth token for secure storage.

    Args:
        token: Plain text token to encrypt

    Returns:
        Encrypted token as base64 string

    Raises:
        ValueError: If TOKEN_ENCRYPTION_KEY not configured
    """
    if not settings.TOKEN_ENCRYPTION_KEY:
        raise ValueError("TOKEN_ENCRYPTION_KEY not configured in settings")

    f = Fernet(settings.TOKEN_ENCRYPTION_KEY.encode())
    return f.encrypt(token.encode()).decode()


def decrypt_token(encrypted_token: str) -> str:
    """
    Decrypt OAuth token for use.

    Args:
        encrypted_token: Encrypted token from database

    Returns:
        Decrypted plain text token

    Raises:
        ValueError: If TOKEN_ENCRYPTION_KEY not configured
        cryptography.fernet.InvalidToken: If token is invalid or key is wrong
    """
    if not settings.TOKEN_ENCRYPTION_KEY:
        raise ValueError("TOKEN_ENCRYPTION_KEY not configured in settings")

    f = Fernet(settings.TOKEN_ENCRYPTION_KEY.encode())
    return f.decrypt(encrypted_token.encode()).decode()


def generate_encryption_key() -> str:
    """
    Generate a new Fernet encryption key.

    Returns:
        Base64-encoded encryption key

    Note:
        Run this once and save the key to TOKEN_ENCRYPTION_KEY environment variable.
        Never commit the key to version control!

    Example:
        >>> key = generate_encryption_key()
        >>> print(f"TOKEN_ENCRYPTION_KEY={key}")
    """
    return Fernet.generate_key().decode()
