"""Citizen OTP, staff passwords, and short-lived sessions."""

import hashlib
import os
import re
import secrets
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field
from .db import connect
from .catalog import validate_location

router = APIRouter(prefix="/api")


def now():
    return datetime.now(timezone.utc)


def stamp():
    return now().isoformat()


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def public_user(row):
    return {k: v for k, v in dict(row).items() if k != "password_hash"}


def hash_password(password):
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 600_000).hex()
    return f"pbkdf2_sha256$600000${salt}${hashed}"


def check_password(password, stored):
    try:
        algorithm, rounds, salt, expected = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(rounds)).hex()
        return secrets.compare_digest(actual, expected)
    except (ValueError, AttributeError, TypeError):
        return False


def issue_session(db, user):
    token = secrets.token_urlsafe(32)
    db.execute(
        "INSERT INTO sessions VALUES (?,?,?)",
        (digest(token), user["id"], (now() + timedelta(hours=12)).isoformat()),
    )
    return {"token": token, "user": public_user(user)}


def limit_requests(request, bucket, limit=30):
    ip = request.client.host if request.client else "unknown"
    attempts = getattr(request.app.state, bucket, {})
    recent = [t for t in attempts.get(ip, []) if (now() - t).total_seconds() < 600]
    if len(recent) >= limit:
        raise HTTPException(429, "Too many requests. Please wait ten minutes.")
    attempts[ip] = recent + [now()]
    setattr(request.app.state, bucket, attempts)


def current_user(authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ")
    with connect() as db:
        row = db.execute(
            "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1",
            (digest(token), stamp()),
        ).fetchone()
    if not row:
        raise HTTPException(401, "Please sign in again.")
    return public_user(row)


def role(user, *roles):
    if user["role"] not in roles:
        raise HTTPException(403, "This action is not available for your account.")


class Phone(BaseModel):
    phone: str = Field(pattern=r"^[6-9]\d{9}$")


class Verify(Phone):
    code: str = Field(pattern=r"^\d{6}$")


class Profile(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    district: str
    locality: str


class StaffLogin(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=1, max_length=128)


@router.post("/auth/staff-login")
def staff_login(body: StaffLogin, request: Request):
    limit_requests(request, "staff_ip")
    with connect() as db:
        user = db.execute(
            "SELECT * FROM users WHERE lower(username)=? AND role IN ('admin','officer') AND active=1",
            (body.username.strip().lower(),),
        ).fetchone()
        if not user or not check_password(body.password, user["password_hash"]):
            raise HTTPException(401, "Incorrect username or password.")
        return issue_session(db, user)


@router.post("/auth/request-otp")
def request_otp(body: Phone, request: Request):
    limit_requests(request, "otp_ip")
    code = f"{secrets.randbelow(1_000_000):06d}"
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        user = db.execute("SELECT role,active FROM users WHERE phone=?", (body.phone,)).fetchone()
        if user and (user["role"] != "citizen" or not user["active"]):
            raise HTTPException(403, "This number cannot use citizen OTP login. Staff must use username and password.")
        old = db.execute("SELECT * FROM otp_requests WHERE phone=?", (body.phone,)).fetchone()
        if old and (now() - datetime.fromisoformat(old["requested_at"])).total_seconds() < 30:
            raise HTTPException(429, "Please wait 30 seconds before requesting another code.")
        db.execute(
            "INSERT OR REPLACE INTO otp_requests VALUES (?,?,?,?,0)",
            (body.phone, digest(code), (now() + timedelta(minutes=5)).isoformat(), stamp()),
        )
    # Requested temporary delivery method: show the code on the login screen.
    # No SMS provider is contacted; this does not verify possession of a phone.
    return {"delivery": "screen", "fallback_code": code, "expires_in": 300}


@router.post("/auth/verify-otp")
def verify_otp(body: Verify):
    result = None
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute("SELECT * FROM otp_requests WHERE phone=?", (body.phone,)).fetchone()
        if not row or row["expires_at"] < stamp() or row["attempts"] >= 5:
            raise HTTPException(400, "Code expired or attempts exceeded. Request a new code.")
        db.execute("UPDATE otp_requests SET attempts=attempts+1 WHERE phone=?", (body.phone,))
        if secrets.compare_digest(digest(body.code), row["code_hash"]):
            user = db.execute("SELECT * FROM users WHERE phone=?", (body.phone,)).fetchone()
            if user and (user["role"] != "citizen" or not user["active"]):
                raise HTTPException(403, "This account cannot use citizen OTP login.")
            db.execute("DELETE FROM otp_requests WHERE phone=?", (body.phone,))
            if not user:
                uid = uuid4().hex
                db.execute("INSERT INTO users(id,phone) VALUES (?,?)", (uid, body.phone))
                user = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
            result = issue_session(db, user)
    # Raise after committing so incorrect attempts count toward the limit.
    if result is None:
        raise HTTPException(400, "Incorrect verification code.")
    return result


@router.get("/me")
def me(user=Depends(current_user)):
    return user


@router.put("/me")
def profile(body: Profile, user=Depends(current_user)):
    role(user, "citizen")
    validate_location(body.district, body.locality)
    if len(body.name.strip()) < 2:
        raise HTTPException(422, "Please enter your name.")
    with connect() as db:
        db.execute(
            "UPDATE users SET name=?,district=?,locality=? WHERE id=?",
            (body.name.strip(), body.district, body.locality, user["id"]),
        )
    return user | body.model_dump()


@router.post("/auth/logout")
def logout(authorization: str = Header(default="")):
    with connect() as db:
        db.execute(
            "DELETE FROM sessions WHERE token_hash=?",
            (digest(authorization.removeprefix("Bearer ")),),
        )
    return {"ok": True}


def seed_admin():
    """Create one initial admin; never create sample officers or citizens."""
    username = (os.getenv("ADMIN_USERNAME") or "admin").strip().lower()
    password = os.getenv("ADMIN_PASSWORD") or "Samadhan@2026!"
    if not re.fullmatch(r"[a-z0-9_.-]{3,40}", username) or not 8 <= len(password) <= 128:
        raise RuntimeError("Use a valid ADMIN_USERNAME and an ADMIN_PASSWORD of 8–128 characters.")
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        existing = db.execute("SELECT * FROM users WHERE role='admin' ORDER BY id LIMIT 1").fetchone()
        if existing and existing["password_hash"]:
            return  # A restart must never reset a password.
        owner = db.execute("SELECT id FROM users WHERE lower(username)=?", (username,)).fetchone()
        if owner and (not existing or owner["id"] != existing["id"]):
            raise RuntimeError("ADMIN_USERNAME already belongs to another account.")
        if existing:
            db.execute("UPDATE users SET username=?,password_hash=? WHERE id=?",
                       (username, hash_password(password), existing["id"]))
            db.execute("DELETE FROM sessions WHERE user_id=?", (existing["id"],))
        else:
            db.execute(
                "INSERT INTO users(id,phone,name,role,username,password_hash) VALUES (?,?,'Administrator','admin',?,?)",
                (uuid4().hex, "", username, hash_password(password)),
            )
