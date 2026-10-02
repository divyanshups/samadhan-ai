import React, { useContext, useEffect, useState } from "react";
import {
  Plus,
  Edit3,
  Trash2,
  ArrowUpRight,
  Bell,
  Megaphone,
  Send,
  Users,
  Check,
} from "lucide-react";
import { api, post, put, remove, date } from "./api";
import { Language, useText, Field, ErrorBox, Empty, Modal } from "./ui";

export function Notices({ user }) {
  const t = useText(),
    lang = useContext(Language),
    [items, setItems] = useState([]),
    [edit, setEdit] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const blank = { title_en: "", title_hi: "", body_en: "", body_hi: "" };
  const load = () =>
    api("/notices")
      .then(setItems)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { id, ...body } = edit;
      await (id ? put("/notices/" + id, body) : post("/notices", body));
      setEdit(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function del(n) {
    if (!confirm(t("Delete this notice?", "यह सूचना हटाएं?"))) return;
    try {
      await remove("/notices/" + n.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {t("AROUND YOUR DISTRICT", "आपके जिले की खबरें")}
          </span>
          <h1>{t("The notice board.", "सूचना बोर्ड।")}</h1>
          <p>
            {t(
              "Local announcements, service information, and important dates.",
              "स्थानीय घोषणाएँ, सेवा की जानकारी और महत्वपूर्ण तारीखें।",
            )}
          </p>
        </div>
        {user.role === "officer" && (
          <button className="primary" onClick={() => setEdit(blank)}>
            <Plus size={18} />
            {t("Create notice", "सूचना बनाएँ")}
          </button>
        )}
      </div>
      <ErrorBox message={error} />
      {items.length ? (
        <div className="notice-grid">
          {items.map((n) => (
            <article className="panel notice" key={n.id}>
              <span className="notice-icon">
                <Megaphone size={22} />
              </span>
              <span className="eyebrow">{n.district}</span>
              <h2>{t(n.title_en, n.title_hi)}</h2>
              <p className="notice-body">{t(n.body_en, n.body_hi)}</p>
              <div className="notice-footer">
                <small>{date(n.updated_at, lang)}</small>
                {user.role === "officer" && (
                  <div className="actions">
                    <button
                      aria-label={t("Edit notice", "सूचना संपादित करें")}
                      className="icon-button"
                      onClick={() =>
                        setEdit({
                          id: n.id,
                          title_en: n.title_en,
                          title_hi: n.title_hi,
                          body_en: n.body_en,
                          body_hi: n.body_hi,
                        })
                      }
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      aria-label={t("Delete notice", "सूचना हटाएं")}
                      className="icon-button danger"
                      onClick={() => del(n)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="panel">
          <Empty title={t("No notices yet", "अभी कोई सूचना नहीं")}>
            {t(
              "District announcements will appear here.",
              "जिले की घोषणाएँ यहाँ दिखाई देंगी।",
            )}
          </Empty>
        </section>
      )}
      {edit && (
        <Modal
          title={t(
            edit.id ? "Edit notice" : "Create notice",
            edit.id ? "सूचना संपादित करें" : "सूचना बनाएँ",
          )}
          onClose={() => setEdit(null)}
        >
          <form onSubmit={save}>
            {[
              ["title_en", "English title", "अंग्रेज़ी शीर्षक"],
              ["title_hi", "Hindi title", "हिंदी शीर्षक"],
              ["body_en", "English notice", "अंग्रेज़ी सूचना"],
              ["body_hi", "Hindi notice", "हिंदी सूचना"],
            ].map(([key, en, hi]) => (
              <Field key={key} label={t(en, hi)}>
                {key.startsWith("body") ? (
                  <textarea
                    required
                    minLength={3}
                    maxLength={4000}
                    rows={4}
                    value={edit[key]}
                    onChange={(e) =>
                      setEdit({ ...edit, [key]: e.target.value })
                    }
                  />
                ) : (
                  <input
                    required
                    minLength={2}
                    maxLength={160}
                    value={edit[key]}
                    onChange={(e) =>
                      setEdit({ ...edit, [key]: e.target.value })
                    }
                  />
                )}
              </Field>
            ))}
            <ErrorBox message={error} />
            <button disabled={busy} className="primary full">
              {t("Publish notice", "सूचना प्रकाशित करें")}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

export function Officers({ catalog }) {
  const t = useText(),
    [items, setItems] = useState([]),
    [edit, setEdit] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    api("/officers")
      .then(setItems)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { id, ...body } = edit;
      await (id ? put("/officers/" + id, body) : post("/officers", body));
      setEdit(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function deactivate(o) {
    if (
      !confirm(
        t(
          "Deactivate this officer? Their past actions will be retained.",
          "अधिकारी निष्क्रिय करें? पुराने कार्य सुरक्षित रहेंगे।",
        ),
      )
    )
      return;
    try {
      await remove("/officers/" + o.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {t("PEOPLE BEHIND THE PROGRESS", "प्रगति के पीछे की टीम")}
          </span>
          <h1>{t("Your officer directory.", "अधिकारी निर्देशिका।")}</h1>
          <p>
            {t(
              "Set the right department and district for every officer.",
              "हर अधिकारी के लिए सही विभाग और जिला चुनें।",
            )}
          </p>
        </div>
        <button
          className="primary"
          onClick={() =>
            setEdit({
              name: "",
              username: "",
              password: "",
              phone: "",
              district: "Bhopal",
              department_id: "pwd",
            })
          }
        >
          <Plus size={18} />
          {t("Add officer", "अधिकारी जोड़ें")}
        </button>
      </div>
      <ErrorBox message={error} />
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {[
                  ["Officer", "अधिकारी"],
                  ["Username", "उपयोगकर्ता नाम"],
                  ["Mobile", "मोबाइल"],
                  ["Department", "विभाग"],
                  ["District", "जिला"],
                  ["Status", "स्थिति"],
                  ["Actions", "कार्रवाई"],
                ].map(([en, hi]) => (
                  <th key={en}>{t(en, hi)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((o) => {
                const d = catalog.departments.find(
                  (d) => d.id === o.department_id,
                );
                return (
                  <tr key={o.id}>
                    <td>
                      <b>{o.name}</b>
                    </td>
                    <td>{o.username || "—"}</td>
                    <td>{o.phone}</td>
                    <td>{t(d?.en, d?.hi)}</td>
                    <td>{o.district}</td>
                    <td>
                      <span
                        className={
                          "badge " + (o.active ? "resolved" : "submitted")
                        }
                      >
                        {o.active
                          ? t("Active", "सक्रिय")
                          : t("Inactive", "निष्क्रिय")}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          className="icon-button"
                          aria-label={t("Edit officer", "अधिकारी संपादित करें")}
                          onClick={() =>
                            setEdit({
                              id: o.id,
                              name: o.name,
                              username: o.username || "",
                              password: "",
                              phone: o.phone,
                              district: o.district,
                              department_id: o.department_id,
                            })
                          }
                        >
                          <Edit3 size={16} />
                        </button>
                        {!!o.active && (
                          <button
                            className="icon-button danger"
                            aria-label={t(
                              "Deactivate officer",
                              "अधिकारी निष्क्रिय करें",
                            )}
                            onClick={() => deactivate(o)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!items.length && (
          <Empty title={t("No officers added", "अभी कोई अधिकारी नहीं")}>
            {t(
              "Add an officer to manage a department’s complaints.",
              "विभाग की शिकायतों के लिए अधिकारी जोड़ें।",
            )}
          </Empty>
        )}
      </section>
      {edit && (
        <Modal
          title={t(
            edit.id ? "Edit officer" : "Add officer",
            edit.id ? "अधिकारी संपादित करें" : "अधिकारी जोड़ें",
          )}
          onClose={() => setEdit(null)}
        >
          <form onSubmit={save}>
            <Field label={t("Name", "नाम")}>
              <input
                required
                minLength={2}
                maxLength={80}
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
              />
            </Field>
            <Field label={t("Login username", "लॉगिन उपयोगकर्ता नाम")}>
              <input required pattern="[A-Za-z0-9_.-]{3,40}" minLength={3} maxLength={40}
                autoComplete="off" value={edit.username}
                onChange={(e) => setEdit({ ...edit, username: e.target.value })} />
            </Field>
            <Field label={edit.id
              ? t("New password (leave blank to keep current)", "नया पासवर्ड (पुराना रखने के लिए खाली छोड़ें)")
              : t("Password", "पासवर्ड")}>
              <input required={!edit.id} type="password" minLength={edit.password ? 8 : undefined}
                maxLength={128} autoComplete="new-password" value={edit.password}
                onChange={(e) => setEdit({ ...edit, password: e.target.value })} />
            </Field>
            <Field label={t("Mobile number", "मोबाइल नंबर")}>
              <input
                required
                pattern="[6-9][0-9]{9}"
                inputMode="numeric"
                maxLength={10}
                value={edit.phone}
                onChange={(e) =>
                  setEdit({ ...edit, phone: e.target.value.replace(/\D/g, "") })
                }
              />
            </Field>
            <Field label={t("District", "जिला")}>
              <select
                value={edit.district}
                onChange={(e) => setEdit({ ...edit, district: e.target.value })}
              >
                {catalog.districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {t(d.en, d.hi)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Department", "विभाग")}>
              <select
                value={edit.department_id}
                onChange={(e) =>
                  setEdit({ ...edit, department_id: e.target.value })
                }
              >
                {catalog.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {t(d.en, d.hi)}
                  </option>
                ))}
              </select>
            </Field>
            <ErrorBox message={error} />
            <button className="primary full" disabled={busy}>
              {t("Save officer", "अधिकारी सुरक्षित करें")}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

export function Updates({ user, onOpen, refresh }) {
  const t = useText(),
    lang = useContext(Language),
    [items, setItems] = useState([]),
    [officers, setOfficers] = useState([]),
    [form, setForm] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = () =>
    api("/updates")
      .then(setItems)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
    if (user.role === "admin")
      api("/officers")
        .then(setOfficers)
        .catch(() => {});
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);
  async function read(u) {
    try {
      await post("/updates/" + u.id + "/read");
      load();
      refresh();
      if (u.complaint_id) onOpen(u.complaint_id);
    } catch (e) {
      setError(e.message);
    }
  }
  async function send(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await post("/messages", form);
      setForm(null);
      load();
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {t("STAY IN THE LOOP", "हर अपडेट की जानकारी")}
          </span>
          <h1>{t("Good to know.", "ज़रूरी अपडेट।")}</h1>
          <p>
            {t(
              "Complaint progress and messages that need your attention.",
              "शिकायत की प्रगति और आपके ध्यान के लिए संदेश।",
            )}
          </p>
        </div>
        {user.role === "admin" && (
          <button
            className="primary"
            onClick={() =>
              setForm({ officer_ids: [], text_en: "", text_hi: "" })
            }
          >
            <Send size={17} />
            {t("Message officers", "अधिकारियों को संदेश")}
          </button>
        )}
      </div>
      <ErrorBox message={error} />
      <section className="panel updates-panel">
        {items.length ? (
          items.map((u) => (
            <button
              className={"update-row " + (!u.is_read ? "unread" : "")}
              key={u.id}
              onClick={() => read(u)}
            >
              <span className="update-icon">
                <Bell size={20} />
              </span>
              <div>
                <span className="eyebrow">
                  {u.kind === "admin_message"
                    ? t("FROM ADMIN", "प्रशासक से")
                    : u.kind === "sent_message"
                      ? t("SENT MESSAGE", "भेजा गया संदेश")
                      : u.kind === "overdue"
                        ? t("TIMELINE UPDATE", "समय संबंधी अपडेट")
                        : t("COMPLAINT UPDATE", "शिकायत अपडेट")}
                </span>
                <p>{t(u.text_en, u.text_hi)}</p>
                <small>
                  {u.complaint_id && u.complaint_id + " · "}
                  {date(u.created_at, lang, true)}
                </small>
              </div>
              {!u.is_read && <i className="unread-dot" />}
              {u.complaint_id && <ArrowUpRight size={18} />}
            </button>
          ))
        ) : (
          <Empty title={t("You’re all caught up", "अभी कोई नया अपडेट नहीं")}>
            {t(
              "New complaint updates and messages will appear here.",
              "शिकायत के अपडेट और संदेश यहाँ दिखाई देंगे।",
            )}
          </Empty>
        )}
      </section>
      {form && (
        <Modal
          title={t("Send an officer message", "अधिकारी को संदेश भेजें")}
          onClose={() => setForm(null)}
        >
          <form onSubmit={send}>
            <fieldset className="officer-checkboxes">
              <legend>{t("Recipients", "प्राप्तकर्ता")}</legend>
              {officers
                .filter((o) => o.active)
                .map((o) => (
                  <label className="checkbox" key={o.id}>
                    <input
                      type="checkbox"
                      checked={form.officer_ids.includes(o.id)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          officer_ids: e.target.checked
                            ? [...form.officer_ids, o.id]
                            : form.officer_ids.filter((id) => id !== o.id),
                        })
                      }
                    />
                    {o.name} · {o.district}
                  </label>
                ))}
            </fieldset>
            <Field label={t("Message in English", "अंग्रेज़ी संदेश")}>
              <textarea
                required
                minLength={2}
                maxLength={2000}
                rows={3}
                value={form.text_en}
                onChange={(e) => setForm({ ...form, text_en: e.target.value })}
              />
            </Field>
            <Field label={t("Message in Hindi", "हिंदी संदेश")}>
              <textarea
                required
                minLength={2}
                maxLength={2000}
                rows={3}
                value={form.text_hi}
                onChange={(e) => setForm({ ...form, text_hi: e.target.value })}
              />
            </Field>
            <ErrorBox message={error} />
            <button
              className="primary full"
              disabled={busy || !form.officer_ids.length}
            >
              {t("Send message", "संदेश भेजें")}
              <Send size={17} />
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
