"""Vapi's saved function tools all call this one webhook."""

import json
import os
import secrets
from datetime import timedelta
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import ValidationError
from .auth import current_user, role, digest, now, stamp
from .db import connect
from .intake import get_draft, apply_patch, unpack, next_stage
from .catalog import CATEGORIES, suggested_categories

router = APIRouter(prefix="/api")


@router.post("/drafts/{draft_id}/voice-session")
def voice_session(draft_id: str, user=Depends(current_user)):
    role(user, "citizen")
    if not all(
        os.getenv(key)
        for key in ["VAPI_PUBLIC_KEY", "VAPI_ASSISTANT_ID", "VAPI_WEBHOOK_SECRET"]
    ):
        raise HTTPException(
            503,
            "Hindi voice is not configured yet. You can continue using the text form.",
        )
    session = secrets.token_urlsafe(32)
    with connect() as db:
        row = get_draft(db, draft_id, user["id"])
        if row["submitted_id"]:
            raise HTTPException(409, "Complaint already submitted.")
        db.execute(
            "UPDATE drafts SET voice_hash=?,voice_expires_at=?,call_id=NULL WHERE id=?",
            (digest(session), (now() + timedelta(hours=2)).isoformat(), draft_id),
        )
    return {
        "draft_session": session,
        "public_key": os.environ["VAPI_PUBLIC_KEY"],
        "assistant_id": os.environ["VAPI_ASSISTANT_ID"],
    }


@router.delete("/drafts/{draft_id}/voice-session")
def stop_voice(draft_id: str, user=Depends(current_user)):
    with connect() as db:
        get_draft(db, draft_id, user["id"])
        db.execute(
            "UPDATE drafts SET voice_hash=NULL,voice_expires_at=NULL WHERE id=?",
            (draft_id,),
        )
    return {"ok": True}


@router.post("/vapi/tools")
def vapi_tools(payload: dict, authorization: str = Header(default="")):
    expected = os.getenv("VAPI_WEBHOOK_SECRET", "")
    if not expected:
        raise HTTPException(503, "Vapi webhook is not configured.")
    if not secrets.compare_digest(authorization, "Bearer " + expected):
        raise HTTPException(401, "Invalid webhook credential.")
    message = payload.get("message", {})
    if message.get("type") != "tool-calls":
        return {"ok": True}
    call = message.get("call", {})
    call_id = call.get("id", "")
    session = (
        call.get("assistantOverrides", {})
        .get("variableValues", {})
        .get("draft_session", "")
    )
    calls = message.get("toolCallList", [])
    if not isinstance(calls, list) or len(calls) > 10:
        raise HTTPException(422, "Invalid tool call list.")
    results = []
    for tool in calls:
        tool_id = tool.get("id", "")
        try:
            if not call_id or not tool_id or not session:
                raise ValueError(
                    "Start this voice call from the signed-in Samadhan website. Missing draft session."
                )
            fn = tool.get("function", {})
            name = fn.get("name") or tool.get("name")
            args = fn.get("arguments", tool.get("parameters", {}))
            if isinstance(args, str):
                args = json.loads(args)
            if not isinstance(args, dict):
                raise ValueError("Tool arguments must be an object.")
            with connect() as db:
                db.execute("BEGIN IMMEDIATE")
                row = db.execute(
                    "SELECT d.* FROM drafts d JOIN users u ON u.id=d.user_id WHERE d.voice_hash=? AND d.voice_expires_at>? AND d.submitted_id IS NULL AND u.active=1",
                    (digest(session), stamp()),
                ).fetchone()
                if not row or (row["call_id"] and row["call_id"] != call_id):
                    raise ValueError(
                        "The draft session has expired or belongs to another call."
                    )
                db.execute(
                    "UPDATE drafts SET call_id=? WHERE id=?", (call_id, row["id"])
                )
                prior = db.execute(
                    "SELECT result FROM tool_results WHERE call_id=? AND tool_id=?",
                    (call_id, tool_id),
                ).fetchone()
                if prior:
                    results.append(json.loads(prior["result"]))
                    continue
                if name in ["get_complaint_context", "show_categories"]:
                    # A server tool must save a signal for the browser, not just
                    # return the choices to the assistant. Do not skip missing fields.
                    if name == "show_categories":
                        db.execute(
                            "UPDATE drafts SET category_requested=1,revision=revision+1,updated_at=? WHERE id=?",
                            (stamp(), row["id"]),
                        )
                    output = {
                        "draft": unpack(row)["data"],
                        "next_field": row["stage"],
                        "category_requested": name == "show_categories" or bool(row["category_requested"]),
                        "categories": [
                            {k: c[k] for k in ["id", "en", "hi", "department_id"]}
                            for c in CATEGORIES.values()
                        ],
                        "suggested_category_ids": suggested_categories(
                            unpack(row)["data"].get("issue_description", "")
                        ),
                    }
                elif name == "update_complaint_draft":
                    fields = args.get("fields", {})
                    if not isinstance(fields, dict):
                        raise ValueError("fields must be an object.")
                    if (
                        "category_id" in fields
                        and args.get("category_confirmed") is not True
                    ):
                        raise ValueError(
                            "Citizen must explicitly select or confirm the category first."
                        )
                    output = apply_patch(db, row, fields)
                    output = {
                        "saved": True,
                        "draft": output["data"],
                        "next_field": output["stage"],
                    }
                elif name == "ready_for_preview":
                    if next_stage(unpack(row)["data"]) != "preview":
                        raise ValueError(
                            "Required information is missing. Continue with "
                            + row["stage"]
                        )
                    db.execute("UPDATE drafts SET ready=1 WHERE id=?", (row["id"],))
                    output = {
                        "ready": True,
                        "message": "The citizen can now press Proceed to Preview. Do not submit.",
                    }
                else:
                    raise ValueError("Unknown tool.")
                result = {
                    "toolCallId": tool_id,
                    "result": json.dumps(
                        output, ensure_ascii=False, separators=(",", ":")
                    ),
                }
                db.execute(
                    "INSERT INTO tool_results VALUES (?,?,?)",
                    (call_id, tool_id, json.dumps(result, ensure_ascii=False)),
                )
                results.append(result)
        except (ValueError, TypeError, ValidationError, HTTPException) as exc:
            reason = exc.detail if isinstance(exc, HTTPException) else str(exc)
            results.append(
                {"toolCallId": tool_id, "error": str(reason)[:500].replace("\n", " ")}
            )
    return {"results": results}
