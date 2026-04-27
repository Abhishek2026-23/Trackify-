from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status
from typing import Optional
from pydantic import BaseModel, field_validator
import bcrypt
from jose import jwt
from src.config.database import get_pool
from src.config.settings import settings
import re

router = APIRouter(prefix="/auth", tags=["auth"])


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8")[:72], hashed.encode("utf-8"))


class LoginRequest(BaseModel):
    phone: str
    password: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        if not re.fullmatch(r"[0-9]{10}", v):
            raise ValueError("Phone must be 10 digits")
        return v


class RegisterRequest(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    password: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        if not re.fullmatch(r"[0-9]{10}", v):
            raise ValueError("Phone must be 10 digits")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


def _create_token(user: dict) -> str:
    expire = datetime.now(timezone.utc) + timedelta(seconds=settings.JWT_EXPIRES_IN)
    payload = {
        "id": user["id"],
        "phone": user["phone"],
        "user_type": user["user_type"],
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


@router.post("/login")
async def login(body: LoginRequest):
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM users WHERE phone = $1", body.phone)
    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = _create_token(dict(row))
    return {
        "token": token,
        "user": {"id": row["id"], "name": row["name"], "phone": row["phone"], "user_type": row["user_type"]},
    }


@router.post("/register", status_code=201)
async def register(body: RegisterRequest):
    pool = await get_pool()
    hashed = hash_password(body.password)
    try:
        row = await pool.fetchrow(
            "INSERT INTO users (name, phone, email, password_hash) VALUES ($1,$2,$3,$4) RETURNING id, name, phone",
            body.name, body.phone, body.email, hashed,
        )
    except Exception as e:
        if "23505" in str(e):
            raise HTTPException(status_code=409, detail="Phone or email already registered")
        raise HTTPException(status_code=500, detail="Registration failed")
    return {"user": dict(row)}
