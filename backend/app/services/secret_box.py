"""Fernet encryption for user-supplied platform tokens (LeetCode cookies).

Tokens are per-user secrets entered in-app. They are encrypted at rest and
never logged. Plaintext exists only in memory for the duration of an outbound
pull request to leetcode.com.
"""
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger(__name__)


class SecretBox:
    """Encrypt/decrypt short strings with the app-derived Fernet key."""

    def __init__(self) -> None:
        self._fernet = Fernet(get_settings().secret_box_key)

    def encrypt(self, plaintext: str) -> str:
        if not plaintext:
            return ""
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        if not ciphertext:
            return ""
        try:
            return self._fernet.decrypt(ciphertext.encode()).decode()
        except InvalidToken:
            # Key rotated or ciphertext from another env — treat as absent
            # rather than crashing every request; the user re-enters tokens.
            log.warning("secret box: decrypt failed (key rotated?) — token treated as missing")
            return ""


def get_secret_box() -> SecretBox:
    return SecretBox()
