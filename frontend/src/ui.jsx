import React, { createContext, useContext, useEffect, useState } from "react";
import { AlertCircle, ArrowUpRight, Inbox, X } from "lucide-react";
import { api } from "./api";
export const Language = createContext("en");
export function useText() {
  const language = useContext(Language);
  return (en, hi) => (language === "hi" ? hi : en);
}
export const statusNames = {
  SUBMITTED: ["Submitted", "दर्ज"],
  ASSIGNED: ["Assigned", "आवंटित"],
  IN_PROGRESS: ["In progress", "कार्य जारी"],
  COMPLETED: ["Awaiting review", "समीक्षा की प्रतीक्षा"],
  RESOLVED: ["Resolved", "हल हो गई"],
};
export function Badge({ status }) {
  const t = useText();
  return (
    <span className={"badge " + status.toLowerCase()}>
      <i />
      {t(...(statusNames[status] || [status, status]))}
    </span>
  );
}
export function ErrorBox({ message }) {
  return message ? (
    <div role="alert" className="error">
      <AlertCircle size={18} />
      <span>{message}</span>
    </div>
  ) : null;
}
export function Empty({ title, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Inbox size={30} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  const t = useText();
  useEffect(() => {
    const f = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", f);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", f);
      document.body.style.overflow = old;
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={"modal " + (wide ? "wide" : "")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            aria-label={t("Close", "बंद करें")}
            className="icon-button"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function ImageView({ id }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true,
      url;
    api("/uploads/" + id, { blob: true })
      .then((blob) => {
        url = URL.createObjectURL(blob);
        if (active) setSrc(url);
      })
      .catch(() => {});
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  return src ? (
    <img className="evidence" src={src} alt="Complaint attachment" />
  ) : null;
}
export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
