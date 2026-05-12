from fastapi import Depends, HTTPException, status

from models.user import User
from routers.auth import get_current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав. Требуется роль admin.",
        )
    return current_user