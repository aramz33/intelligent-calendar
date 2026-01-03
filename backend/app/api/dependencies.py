from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.security import decode_access_token, get_password_hash
from app.models.user import User
from app.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def get_current_user(
        token: Optional[str] = Depends(oauth2_scheme),
        db: Session = Depends(get_db)
) -> User:
    """Dependency to get the current authenticated user"""

    # DEV MODE: Bypass authentication and return/create a test user
    if settings.DEV_DISABLE_AUTH:
        dev_user = db.query(User).filter(User.email == "dev@example.com").first()
        if not dev_user:
            try:
                # Create a dev user on the fly
                dev_user = User(
                    email="dev@example.com",
                    hashed_password=get_password_hash("devpassword"),
                    full_name="Development User",
                    timezone="UTC"
                )
                db.add(dev_user)
                db.commit()
                db.refresh(dev_user)
            except Exception:
                # Handle race condition - another request might have created it
                db.rollback()
                dev_user = db.query(User).filter(User.email == "dev@example.com").first()
        return dev_user

    # Normal authentication flow
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if token is None:
        raise credentials_exception

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id: int = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception

    return user