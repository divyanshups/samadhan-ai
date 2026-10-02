"""Complaint lifecycle, notices, officer accounts, and in-app updates."""

import io
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field, ConfigDict
from PIL import Image, UnidentifiedImageError
from .auth import current_user, role, now, stamp, hash_password, public_user
from .catalog import CATEGORIES, DEPARTMENTS, DISTRICTS, validate_location
from .db import connect, ROOT
from .intake import Patch, get_draft

router = APIRouter(prefix="/api")
UPLOAD_DIR = ROOT / "data/uploads"


def notify(db, user_ids, en, hi, cid=None, kind="complaint"):
    db.executemany(
        "INSERT INTO updates(user_id,kind,text_en,text_hi,complaint_id,created_at) VALUES (?,?,?,?,?,?)",
        [(uid, kind, en, hi, cid, stamp()) for uid in set(user_ids)],
    )


def officers(db, complaint):
    return [
        r["id"]
        for r in db.execute(
            "SELECT id FROM users WHERE role='officer' AND active=1 AND district=? AND department_id=?",
            (complaint["district"], complaint["department_id"]),
        )
    ]


def admins(db):
    return [
        r["id"]
        for r in db.execute("SELECT id FROM users WHERE role='admin' AND active=1")
    ]


def event(db, cid, status, note, actor=None):
    db.execute(
        "INSERT INTO complaint_events(complaint_id,actor_id,status,note,created_at) VALUES (?,?,?,?,?)",
        (cid, actor, status, note, stamp()),
    )


def visible(user, c):
    return (
        user["role"] == "admin"
        or (user["role"] == "citizen" and c["user_id"] == user["id"])
        or (
            user["role"] == "officer"
            and c["department_id"] == user["department_id"]
            and c["district"] == user["district"]
        )
    )


def get_complaint(db, cid, user):
    c = db.execute("SELECT * FROM complaints WHERE id=?", (cid,)).fetchone()
    if not c or not visible(user, c):
        raise HTTPException(404, "Complaint not found.")
    return dict(c)


def serialize(c):
    result = dict(c)
    result["data"] = json.loads(result["data"])
    result["estimate"] = json.loads(result["estimate"])
    result["overdue"] = result["due_at"] < stamp() and result["status"] not in [
        "COMPLETED",
        "RESOLVED",
    ]
    return result


class Submission(Patch):
    citizen_name: str = Field(min_length=2, max_length=80)
    district: str
    locality: str
    pincode: str = Field(pattern=r"^[1-9]\d{5}$")
    image_id: str | None = None
    confirmed: bool


@router.post("/drafts/{draft_id}/submit")
def submit(draft_id: str, body: Submission, user=Depends(current_user)):
    role(user, "citizen")
    if not body.confirmed:
        raise HTTPException(422, "Please confirm the complaint details.")
    validate_location(body.district, body.locality)
    data = body.model_dump(
        exclude={"confirmed", "citizen_name", "district", "locality"}
    )
    for field in [
        "issue_description",
        "house_or_landmark",
        "area",
        "issue_duration_or_start_date",
        "category_id",
    ]:
        if not isinstance(data[field], str) or not data[field].strip():
            raise HTTPException(422, f'{field.replace("_"," ")} is required.')
        data[field] = data[field].strip()
    if data["category_id"] not in CATEGORIES or len(body.citizen_name.strip()) < 2:
        raise HTTPException(422, "Check the name and selected category.")
    category = CATEGORIES[data["category_id"]]
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        draft = get_draft(db, draft_id, user["id"])
        if draft["submitted_id"]:
            return serialize(get_complaint(db, draft["submitted_id"], user))
        if (
            body.image_id
            and not db.execute(
                "SELECT id FROM uploads WHERE id=? AND user_id=?",
                (body.image_id, user["id"]),
            ).fetchone()
        ):
            raise HTTPException(422, "Upload your own complaint image first.")
        created = now()
        cid = "SAM-" + created.strftime("%Y") + "-" + uuid4().hex[:8].upper()
        dept = None if category["manual_allocation"] else category["department_id"]
        estimate = {
            k: category[k] for k in ["min_days", "max_days", "sop_ref", "sop_version"]
        }
        estimate.update(
            basis="Illustrative prototype SOP; calendar days from submission",
            earliest_at=(created + timedelta(days=category["min_days"])).isoformat(),
            latest_at=(created + timedelta(days=category["max_days"])).isoformat(),
        )
        db.execute(
            """INSERT INTO complaints(id,user_id,draft_id,citizen_name,phone,district,locality,data,category_id,department_id,status,created_at,updated_at,estimate,due_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                cid,
                user["id"],
                draft_id,
                body.citizen_name.strip(),
                user["phone"],
                body.district,
                body.locality,
                json.dumps(data, ensure_ascii=False),
                category["id"],
                dept,
                "SUBMITTED",
                created.isoformat(),
                created.isoformat(),
                json.dumps(estimate),
                estimate["latest_at"],
            ),
        )
        db.execute(
            "UPDATE drafts SET submitted_id=?,voice_hash=NULL,voice_expires_at=NULL WHERE id=?",
            (cid, draft_id),
        )
        event(
            db,
            cid,
            "SUBMITTED",
            "Complaint registered after citizen review.",
            user["id"],
        )
        c = get_complaint(db, cid, user)
        notify(
            db,
            [user["id"]],
            f'Complaint registered. Estimated routine action: {category["min_days"]}–{category["max_days"]} calendar days, based on prototype SOP.',
            f'शिकायत दर्ज हुई। प्रोटोटाइप SOP के अनुसार अनुमानित समय: {category["min_days"]}–{category["max_days"]} कैलेंडर दिन।',
            cid,
        )
        notify(
            db,
            officers(db, c) if dept else admins(db),
            (
                "New complaint received."
                if dept
                else "A complaint needs department allocation."
            ),
            "नई शिकायत प्राप्त हुई।" if dept else "शिकायत का विभाग आवंटित करना है।",
            cid,
        )
        return serialize(c)


@router.get("/complaints")
def list_complaints(user=Depends(current_user)):
    with connect() as db:
        if user["role"] == "admin":
            rows = db.execute(
                "SELECT * FROM complaints ORDER BY created_at DESC"
            ).fetchall()
        elif user["role"] == "officer":
            rows = db.execute(
                "SELECT * FROM complaints WHERE district=? AND department_id=? ORDER BY created_at DESC",
                (user["district"], user["department_id"]),
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM complaints WHERE user_id=? ORDER BY created_at DESC",
                (user["id"],),
            ).fetchall()
    return [serialize(r) for r in rows]


@router.get("/complaints/{cid}")
def detail(cid: str, user=Depends(current_user)):
    with connect() as db:
        c = get_complaint(db, cid, user)
        events = [
            dict(r)
            for r in db.execute(
                "SELECT status,note,created_at FROM complaint_events WHERE complaint_id=? ORDER BY id",
                (cid,),
            )
        ]
    return serialize(c) | {"events": events}


class Status(BaseModel):
    status: str
    employee_name: str = Field(default="", max_length=100)
    remarks: str = Field(min_length=3, max_length=2000)


@router.post("/complaints/{cid}/status")
def status(cid: str, body: Status, user=Depends(current_user)):
    role(user, "officer")
    allowed = {
        "SUBMITTED": ["ASSIGNED"],
        "ASSIGNED": ["IN_PROGRESS"],
        "IN_PROGRESS": ["COMPLETED"],
    }
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        c = get_complaint(db, cid, user)
        if body.status not in allowed.get(c["status"], []):
            raise HTTPException(
                409, "Follow the order: Assigned → In progress → Completed."
            )
        if len(body.remarks.strip()) < 3:
            raise HTTPException(422, "Add a meaningful remark.")
        employee = (
            body.employee_name.strip()
            if body.status == "ASSIGNED"
            else c["employee_name"]
        )
        if not employee:
            raise HTTPException(
                422, "Enter the employee responsible for this complaint."
            )
        completed = stamp() if body.status == "COMPLETED" else None
        due = (now() + timedelta(days=7)).isoformat() if completed else None
        db.execute(
            "UPDATE complaints SET status=?,employee_name=?,completed_at=?,review_due_at=?,updated_at=? WHERE id=?",
            (body.status, employee, completed, due, stamp(), cid),
        )
        event(db, cid, body.status, body.remarks.strip(), user["id"])
        notify(
            db,
            [c["user_id"]] + officers(db, c),
            (
                "Work completed. Please confirm whether your issue is resolved within seven days."
                if completed
                else "Complaint status updated: " + body.status
            ),
            (
                "कार्य पूरा हुआ। कृपया सात दिनों में बताएं कि समस्या हल हुई या नहीं।"
                if completed
                else "शिकायत की स्थिति अपडेट हुई।"
            ),
            cid,
        )
    return detail(cid, user)


class Remark(BaseModel):
    remarks: str = Field(min_length=3, max_length=2000)


@router.post("/complaints/{cid}/remarks")
def add_remark(cid: str, body: Remark, user=Depends(current_user)):
    role(user, "officer")
    with connect() as db:
        c = get_complaint(db, cid, user)
        if c["status"] == "RESOLVED" or len(body.remarks.strip()) < 3:
            raise HTTPException(409, "Add a valid remark to an open complaint.")
        event(db, cid, c["status"], body.remarks.strip(), user["id"])
        notify(
            db,
            [c["user_id"]],
            "The officer added a progress remark.",
            "अधिकारी ने प्रगति संबंधी टिप्पणी जोड़ी है।",
            cid,
        )
    return detail(cid, user)


class Feedback(BaseModel):
    resolved: bool
    remarks: str = Field(default="", max_length=2000)


@router.post("/complaints/{cid}/feedback")
def feedback(cid: str, body: Feedback, user=Depends(current_user)):
    role(user, "citizen")
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        c = get_complaint(db, cid, user)
        if c["status"] != "COMPLETED":
            raise HTTPException(409, "This complaint is not awaiting feedback.")
        state = "RESOLVED" if body.resolved else "IN_PROGRESS"
        note = (
            "Citizen confirmed resolution."
            if body.resolved
            else "Citizen reported not resolved. Complaint reopened."
        ) + (" " + body.remarks.strip() if body.remarks.strip() else "")
        db.execute(
            "UPDATE complaints SET status=?,resolved_at=?,review_due_at=NULL,completed_at=?,reopened_count=reopened_count+?,overdue_notified=?,updated_at=? WHERE id=?",
            (
                state,
                stamp() if body.resolved else None,
                c["completed_at"] if body.resolved else None,
                0 if body.resolved else 1,
                c["overdue_notified"] if body.resolved else 0,
                stamp(),
                cid,
            ),
        )
        event(db, cid, state, note, user["id"])
        notify(
            db,
            [c["user_id"]] + officers(db, c),
            (
                "Citizen confirmed resolution."
                if body.resolved
                else "Complaint reopened after citizen feedback."
            ),
            (
                "नागरिक ने समाधान की पुष्टि की।"
                if body.resolved
                else "नागरिक की प्रतिक्रिया पर शिकायत फिर खोली गई।"
            ),
            cid,
        )
    return detail(cid, user)


class Allocation(BaseModel):
    department_id: str
    remarks: str = Field(min_length=3, max_length=1000)


@router.post("/complaints/{cid}/allocate")
def allocate(cid: str, body: Allocation, user=Depends(current_user)):
    role(user, "admin")
    if body.department_id not in DEPARTMENTS or body.department_id == "general":
        raise HTTPException(422, "Choose an operational department.")
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        c = get_complaint(db, cid, user)
        if c["department_id"] is not None or c["status"] != "SUBMITTED":
            raise HTTPException(
                409, "Only unallocated complaints can be allocated here."
            )
        db.execute(
            "UPDATE complaints SET department_id=?,updated_at=? WHERE id=?",
            (body.department_id, stamp(), cid),
        )
        c["department_id"] = body.department_id
        event(
            db,
            cid,
            c["status"],
            "Department allocated: "
            + DEPARTMENTS[body.department_id]["en"]
            + ". "
            + body.remarks,
            user["id"],
        )
        notify(
            db,
            officers(db, c) + [c["user_id"]],
            "Complaint allocated to " + DEPARTMENTS[body.department_id]["en"],
            "शिकायत " + DEPARTMENTS[body.department_id]["hi"] + " को आवंटित हुई।",
            cid,
        )
    return detail(cid, user)


@router.get("/updates")
def updates(user=Depends(current_user)):
    with connect() as db:
        return [
            dict(r)
            for r in db.execute(
                "SELECT * FROM updates WHERE user_id=? ORDER BY id DESC LIMIT 200",
                (user["id"],),
            )
        ]


@router.post("/updates/{update_id}/read")
def mark_read(update_id: int, user=Depends(current_user)):
    with connect() as db:
        db.execute(
            "UPDATE updates SET is_read=1 WHERE id=? AND user_id=?",
            (update_id, user["id"]),
        )
    return {"ok": True}


class Message(BaseModel):
    officer_ids: list[str] = Field(min_length=1, max_length=100)
    text_en: str = Field(min_length=2, max_length=2000)
    text_hi: str = Field(min_length=2, max_length=2000)


@router.post("/messages")
def send_message(body: Message, user=Depends(current_user)):
    role(user, "admin")
    with connect() as db:
        valid = {
            r["id"]
            for r in db.execute(
                "SELECT id FROM users WHERE role='officer' AND active=1"
            )
        }
        if not set(body.officer_ids) <= valid:
            raise HTTPException(422, "Select active officer accounts.")
        notify(db, body.officer_ids, body.text_en, body.text_hi, kind="admin_message")
        notify(
            db,
            [user["id"]],
            f"Message sent to {len(set(body.officer_ids))} officer(s): " + body.text_en,
            f"{len(set(body.officer_ids))} अधिकारियों को संदेश भेजा: " + body.text_hi,
            kind="sent_message",
        )
    return {"ok": True}


class Officer(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(pattern=r"^[6-9]\d{9}$")
    district: str
    department_id: str
    username: str = Field(pattern=r"^[a-zA-Z0-9_.-]{3,40}$")
    password: str | None = Field(default=None, max_length=128)


@router.get("/officers")
def list_officers(user=Depends(current_user)):
    role(user, "admin")
    with connect() as db:
        return [
            public_user(r)
            for r in db.execute(
                "SELECT * FROM users WHERE role='officer' ORDER BY active DESC,name"
            )
        ]


@router.post("/officers")
def create_officer(body: Officer, user=Depends(current_user)):
    role(user, "admin")
    if body.district not in DISTRICTS or body.department_id not in DEPARTMENTS:
        raise HTTPException(422, "Choose a district and department.")
    if not body.password or len(body.password) < 8:
        raise HTTPException(422, "Set an officer password of at least 8 characters.")
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        if db.execute("SELECT id FROM users WHERE phone=?", (body.phone,)).fetchone():
            raise HTTPException(409, "This phone number already belongs to an account.")
        if db.execute("SELECT id FROM users WHERE lower(username)=?", (body.username.lower(),)).fetchone():
            raise HTTPException(409, "Username is already in use.")
        uid = uuid4().hex
        db.execute(
            "INSERT INTO users(id,name,phone,role,district,department_id,username,password_hash) VALUES (?,?,?,'officer',?,?,?,?)",
            (uid, body.name.strip(), body.phone, body.district, body.department_id, body.username.lower(), hash_password(body.password)),
        )
    return {"id": uid}


@router.put("/officers/{uid}")
def edit_officer(uid: str, body: Officer, user=Depends(current_user)):
    role(user, "admin")
    if body.district not in DISTRICTS or body.department_id not in DEPARTMENTS:
        raise HTTPException(422, "Choose a district and department.")
    if body.password and len(body.password) < 8:
        raise HTTPException(422, "Use a password of at least 8 characters.")
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        if not db.execute(
            "SELECT id FROM users WHERE id=? AND role='officer'", (uid,)
        ).fetchone():
            raise HTTPException(404, "Officer not found.")
        if db.execute(
            "SELECT id FROM users WHERE phone=? AND id<>?", (body.phone, uid)
        ).fetchone():
            raise HTTPException(409, "Phone number is already in use.")
        if db.execute("SELECT id FROM users WHERE lower(username)=? AND id<>?", (body.username.lower(), uid)).fetchone():
            raise HTTPException(409, "Username is already in use.")
        current = db.execute("SELECT password_hash FROM users WHERE id=?", (uid,)).fetchone()
        if not current["password_hash"] and not body.password:
            raise HTTPException(422, "Set a password for this existing officer's first staff login.")
        db.execute(
            "UPDATE users SET name=?,phone=?,district=?,department_id=?,username=?,password_hash=? WHERE id=?",
            (body.name.strip(), body.phone, body.district, body.department_id, body.username.lower(), hash_password(body.password) if body.password else current["password_hash"], uid),
        )
        db.execute("DELETE FROM sessions WHERE user_id=?", (uid,))
    return {"ok": True}


@router.delete("/officers/{uid}")
def delete_officer(uid: str, user=Depends(current_user)):
    role(user, "admin")
    with connect() as db:
        if not db.execute(
            "UPDATE users SET active=0 WHERE id=? AND role='officer'", (uid,)
        ).rowcount:
            raise HTTPException(404, "Officer not found.")
        db.execute("DELETE FROM sessions WHERE user_id=?", (uid,))
    return {"ok": True}


class Notice(BaseModel):
    title_en: str = Field(min_length=2, max_length=160)
    title_hi: str = Field(min_length=2, max_length=160)
    body_en: str = Field(min_length=3, max_length=4000)
    body_hi: str = Field(min_length=3, max_length=4000)


@router.get("/notices")
def notices(user=Depends(current_user)):
    with connect() as db:
        rows = (
            db.execute("SELECT * FROM notices ORDER BY created_at DESC")
            if user["role"] == "admin"
            else db.execute(
                "SELECT * FROM notices WHERE district=? ORDER BY created_at DESC",
                (user["district"],),
            )
        )
        return [dict(r) for r in rows]


@router.post("/notices")
def create_notice(body: Notice, user=Depends(current_user)):
    role(user, "officer")
    with connect() as db:
        nid = uuid4().hex
        db.execute(
            "INSERT INTO notices VALUES (?,?,?,?,?,?,?,?,?)",
            (
                nid,
                user["id"],
                user["district"],
                body.title_en,
                body.title_hi,
                body.body_en,
                body.body_hi,
                stamp(),
                stamp(),
            ),
        )
    return {"id": nid}


@router.put("/notices/{nid}")
def edit_notice(nid: str, body: Notice, user=Depends(current_user)):
    role(user, "officer")
    with connect() as db:
        if not db.execute(
            "UPDATE notices SET title_en=?,title_hi=?,body_en=?,body_hi=?,updated_at=? WHERE id=? AND district=?",
            (
                body.title_en,
                body.title_hi,
                body.body_en,
                body.body_hi,
                stamp(),
                nid,
                user["district"],
            ),
        ).rowcount:
            raise HTTPException(404, "Notice not found in your district.")
    return {"ok": True}


@router.delete("/notices/{nid}")
def delete_notice(nid: str, user=Depends(current_user)):
    role(user, "officer")
    with connect() as db:
        if not db.execute(
            "DELETE FROM notices WHERE id=? AND district=?", (nid, user["district"])
        ).rowcount:
            raise HTTPException(404, "Notice not found in your district.")
    return {"ok": True}


@router.post("/uploads")
async def upload(file: UploadFile = File(...), user=Depends(current_user)):
    role(user, "citizen")
    content = await file.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(422, "Choose an image smaller than 5 MB.")
    try:
        Image.MAX_IMAGE_PIXELS = 20_000_000
        with Image.open(io.BytesIO(content)) as picture:
            if picture.format not in ["JPEG", "PNG", "WEBP"]:
                raise ValueError("unsupported")
            if picture.width * picture.height > 20_000_000:
                raise ValueError("image dimensions too large")
            picture.load()
            picture = picture.convert("RGB")
            picture.thumbnail((2000, 2000))
            output = io.BytesIO()
            picture.save(output, format="JPEG", quality=88)
    except (UnidentifiedImageError, ValueError, OSError, Image.DecompressionBombError):
        raise HTTPException(422, "Choose a valid JPEG, PNG or WebP image.")
    uid = uuid4().hex
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    (UPLOAD_DIR / (uid + ".jpg")).write_bytes(output.getvalue())
    with connect() as db:
        db.execute(
            "INSERT INTO uploads VALUES (?,?,?,?)",
            (uid, user["id"], uid + ".jpg", "image/jpeg"),
        )
    return {"id": uid}


@router.get("/uploads/{uid}")
def image(uid: str, user=Depends(current_user)):
    with connect() as db:
        item = db.execute("SELECT * FROM uploads WHERE id=?", (uid,)).fetchone()
        permitted = item and item["user_id"] == user["id"]
        if item and not permitted:
            linked = db.execute(
                "SELECT * FROM complaints WHERE json_extract(data,'$.image_id')=?",
                (uid,),
            ).fetchall()
            permitted = any(visible(user, c) for c in linked)
    if not item or not permitted:
        raise HTTPException(404, "Image not found.")
    return FileResponse(UPLOAD_DIR / item["filename"], media_type="image/jpeg")


@router.get("/sops/{category_id}")
def sop(category_id: str, user=Depends(current_user)):
    if category_id not in CATEGORIES:
        raise HTTPException(404, "SOP not found.")
    category = CATEGORIES[category_id]
    return {
        "category": category,
        "text": (ROOT.parent / category["sop_ref"]).read_text(encoding="utf-8"),
    }


@router.get("/analytics")
def analytics(user=Depends(current_user)):
    role(user, "admin")
    with connect() as db:
        rows = [dict(r) for r in db.execute("SELECT * FROM complaints")]
    durations = [
        (
            datetime.fromisoformat(c["resolved_at"])
            - datetime.fromisoformat(c["created_at"])
        ).total_seconds()
        / 86400
        for c in rows
        if c["resolved_at"]
    ]
    return {
        "total": len(rows),
        "resolved": sum(c["status"] == "RESOLVED" for c in rows),
        "needs_allocation": sum(c["department_id"] is None for c in rows),
        "reopened": sum(c["reopened_count"] > 0 for c in rows),
        "overdue": sum(
            c["due_at"] < stamp() and c["status"] not in ["COMPLETED", "RESOLVED"]
            for c in rows
        ),
        "average_resolution_days": (
            round(sum(durations) / len(durations), 1) if durations else None
        ),
        "departments": [
            {
                "id": d,
                "label": v["en"],
                "count": sum(c["department_id"] == d for c in rows),
            }
            for d, v in DEPARTMENTS.items()
        ],
        "districts": [
            {"label": d, "count": sum(c["district"] == d for c in rows)}
            for d in DISTRICTS
        ],
        "statuses": {
            s: sum(c["status"] == s for c in rows)
            for s in ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "RESOLVED"]
        },
    }


def run_review_job():
    """Safe to rerun: state checks and notifications commit in one transaction."""
    with connect() as db:
        db.execute("BEGIN IMMEDIATE")
        for c in db.execute(
            "SELECT * FROM complaints WHERE status='COMPLETED' AND review_due_at<=?",
            (stamp(),),
        ).fetchall():
            db.execute(
                "UPDATE complaints SET status='RESOLVED',resolved_at=?,review_due_at=NULL,updated_at=? WHERE id=?",
                (stamp(), stamp(), c["id"]),
            )
            event(
                db,
                c["id"],
                "RESOLVED",
                "Automatically closed after seven days without citizen feedback.",
            )
            notify(
                db,
                [c["user_id"]] + officers(db, c),
                "Closed after seven days without feedback.",
                "सात दिन तक प्रतिक्रिया न मिलने पर शिकायत बंद की गई।",
                c["id"],
            )
        for c in db.execute(
            "SELECT * FROM complaints WHERE status NOT IN ('COMPLETED','RESOLVED') AND due_at<? AND overdue_notified=0",
            (stamp(),),
        ).fetchall():
            db.execute(
                "UPDATE complaints SET overdue_notified=1 WHERE id=?", (c["id"],)
            )
            notify(
                db,
                [c["user_id"]] + officers(db, c) + admins(db),
                "The estimated SOP timeline has passed. Officer follow-up is needed.",
                "अनुमानित SOP समय बीत गया है। अधिकारी की अनुवर्ती कार्रवाई आवश्यक है।",
                c["id"],
                kind="overdue",
            )
