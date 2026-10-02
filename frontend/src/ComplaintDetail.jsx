import React, { useContext, useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  MapPin,
  Phone,
  User,
  BookOpen,
  ArrowRight,
  CalendarDays,
} from "lucide-react";
import { api, post, date } from "./api";
import {
  Language,
  useText,
  Badge,
  Modal,
  Field,
  ErrorBox,
  ImageView,
  statusNames,
} from "./ui";
export default function ComplaintDetail({
  id,
  user,
  catalog,
  onClose,
  onChange,
}) {
  const t = useText(),
    lang = useContext(Language),
    [c, setC] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [remarks, setRemarks] = useState(""),
    [employee, setEmployee] = useState(""),
    [department, setDepartment] = useState("pwd"),
    [sop, setSop] = useState(null);
  useEffect(() => {
    api("/complaints/" + id)
      .then(setC)
      .catch((e) => setError(e.message));
  }, [id]);
  async function action(path, body) {
    setBusy(true);
    setError("");
    try {
      const updated = await post("/complaints/" + id + path, body);
      setC(updated);
      setRemarks("");
      onChange();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const next = {
    SUBMITTED: "ASSIGNED",
    ASSIGNED: "IN_PROGRESS",
    IN_PROGRESS: "COMPLETED",
  }[c?.status];
  const category = catalog.categories.find((x) => x.id === c?.category_id),
    dept = catalog.departments.find((x) => x.id === c?.department_id);
  return (
    <Modal
      title={t("Complaint details", "शिकायत का विवरण")}
      onClose={onClose}
      wide
    >
      <ErrorBox message={error} />
      {!c ? (
        <p>{t("Loading…", "लोड हो रहा है…")}</p>
      ) : (
        <>
          <div className="detail-header">
            <span className="complaint-id">{c.id}</span>
            <Badge status={c.status} />
          </div>
          <h2 className="issue-title">{c.data.issue_description}</h2>
          <p className="muted">
            {t(category?.en, category?.hi)} ·{" "}
            {dept
              ? t(dept.en, dept.hi)
              : t("Awaiting department allocation", "विभाग आवंटन की प्रतीक्षा")}
          </p>
          <div className={"estimate-box " + (c.overdue ? "late" : "")}>
            <CalendarDays size={25} />
            <div>
              <b>
                {t("Expected timeline", "अनुमानित समय")}: {c.estimate.min_days}–
                {c.estimate.max_days} {t("calendar days", "कैलेंडर दिन")}
              </b>
              <p>
                {date(c.estimate.earliest_at, lang)} –{" "}
                {date(c.estimate.latest_at, lang)}
              </p>
              <small>
                {t(
                  "An estimate for routine action, based on the prototype SOP. Actual work may take longer.",
                  "प्रोटोटाइप SOP के अनुसार सामान्य कार्य का अनुमान। वास्तविक काम में अधिक समय लग सकता है।",
                )}
              </small>
              {c.overdue && (
                <p className="overdue">
                  {t(
                    "The estimated date has passed. This complaint needs officer follow-up.",
                    "अनुमानित तारीख बीत गई है। अधिकारी की अनुवर्ती कार्रवाई आवश्यक है।",
                  )}
                </p>
              )}
              <button
                className="text-button"
                onClick={() =>
                  api("/sops/" + c.category_id)
                    .then(setSop)
                    .catch((e) => setError(e.message))
                }
              >
                <BookOpen size={14} />
                {t("View SOP reference", "SOP संदर्भ देखें")} ·{" "}
                {c.estimate.sop_version}
              </button>
            </div>
          </div>
          <div className="detail-grid">
            <section>
              <h3>{t("Submitted information", "दर्ज जानकारी")}</h3>
              <dl className="detail-data">
                <div>
                  <dt>{t("Citizen", "नागरिक")}</dt>
                  <dd>{c.citizen_name}</dd>
                </div>
                <div>
                  <dt>{t("Mobile", "मोबाइल")}</dt>
                  <dd>+91 {c.phone}</dd>
                </div>
                <div>
                  <dt>{t("Issue location", "समस्या का स्थान")}</dt>
                  <dd>
                    {[
                      c.data.house_or_landmark,
                      c.data.area,
                      c.data.ward ? t("Ward ", "वार्ड ") + c.data.ward : "",
                      c.locality,
                      c.district,
                      c.data.pincode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </dd>
                </div>
                <div>
                  <dt>{t("Issue existing since", "समस्या कब से")}</dt>
                  <dd>{c.data.issue_duration_or_start_date}</dd>
                </div>
                <div>
                  <dt>{t("Registered on", "दर्ज करने का समय")}</dt>
                  <dd>{date(c.created_at, lang, true)}</dd>
                </div>
                <div>
                  <dt>{t("Assigned employee", "नियुक्त कर्मचारी")}</dt>
                  <dd>
                    {c.employee_name ||
                      t("Not yet assigned", "अभी नियुक्त नहीं")}
                  </dd>
                </div>
                {c.data.remarks && (
                  <div>
                    <dt>{t("Citizen remarks", "नागरिक की टिप्पणी")}</dt>
                    <dd>{c.data.remarks}</dd>
                  </div>
                )}
                {c.reopened_count > 0 && (
                  <div>
                    <dt>{t("Reopened", "फिर खोली गई")}</dt>
                    <dd>
                      {c.reopened_count} {t("time(s)", "बार")}
                    </dd>
                  </div>
                )}
              </dl>
              {c.data.image_id && <ImageView id={c.data.image_id} />}
            </section>
            <section>
              <h3>{t("Complaint journey", "शिकायत की प्रगति")}</h3>
              <ol className="timeline">
                {c.events.map((e, i) => (
                  <li key={i}>
                    <i className={e.status.toLowerCase()} />
                    <span>{date(e.created_at, lang, true)}</span>
                    <b>
                      {t(...(statusNames[e.status] || [e.status, e.status]))}
                    </b>
                    <p>{e.note}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>
          {user.role === "citizen" && c.status === "COMPLETED" && (
            <section className="feedback-box">
              <h3>
                {t(
                  "Has your issue been resolved?",
                  "क्या आपकी समस्या हल हो गई है?",
                )}
              </h3>
              <p>
                {t("Please respond by ", "कृपया इस तारीख तक प्रतिक्रिया दें: ")}
                {date(c.review_due_at, lang, true)}.{" "}
                {t(
                  "Without feedback, the complaint will close automatically after seven days.",
                  "प्रतिक्रिया न मिलने पर सात दिन बाद शिकायत अपने आप बंद हो जाएगी।",
                )}
              </p>
              <Field
                label={t(
                  "Your feedback (optional)",
                  "आपकी प्रतिक्रिया (वैकल्पिक)",
                )}
              >
                <textarea
                  rows={2}
                  value={remarks}
                  maxLength={2000}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </Field>
              <div className="actions">
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() =>
                    action("/feedback", { resolved: true, remarks })
                  }
                >
                  <CheckCircle2 size={17} />
                  {t("Yes, resolved", "हाँ, हल हो गई")}
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    action("/feedback", { resolved: false, remarks })
                  }
                >
                  {t("Not resolved · reopen", "हल नहीं हुई · फिर खोलें")}
                </button>
              </div>
            </section>
          )}
          {user.role === "officer" && c.status !== "RESOLVED" && (
            <section className="action-panel">
              <h3>{t("Update this complaint", "शिकायत अपडेट करें")}</h3>
              {next === "ASSIGNED" && (
                <Field
                  label={t(
                    "Responsible employee name",
                    "जिम्मेदार कर्मचारी का नाम",
                  )}
                >
                  <input
                    maxLength={100}
                    value={employee}
                    onChange={(e) => setEmployee(e.target.value)}
                    placeholder={t(
                      "Enter the employee name",
                      "कर्मचारी का नाम दर्ज करें",
                    )}
                  />
                </Field>
              )}
              <Field
                label={t(
                  "Progress / completion remarks",
                  "प्रगति / कार्य पूरा होने की टिप्पणी",
                )}
              >
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </Field>
              <div className="actions">
                {next && (
                  <button
                    className="primary"
                    disabled={
                      busy ||
                      remarks.trim().length < 3 ||
                      (next === "ASSIGNED" && !employee.trim())
                    }
                    onClick={() =>
                      action("/status", {
                        status: next,
                        employee_name: employee,
                        remarks,
                      })
                    }
                  >
                    {t("Mark ", "स्थिति: ")}
                    {next === "COMPLETED"
                      ? t(
                          "Completed · request review",
                          "पूरा हुआ · समीक्षा माँगें",
                        )
                      : t(...statusNames[next])}
                    <ArrowRight size={17} />
                  </button>
                )}
                <button
                  className="secondary"
                  disabled={busy || remarks.trim().length < 3}
                  onClick={() => action("/remarks", { remarks })}
                >
                  {t("Add progress remark", "प्रगति की टिप्पणी जोड़ें")}
                </button>
              </div>
              {c.status === "COMPLETED" && (
                <p className="muted">
                  {t(
                    "Citizen feedback is pending. No further status change is needed from you.",
                    "नागरिक की प्रतिक्रिया बाकी है। अभी स्थिति बदलने की आवश्यकता नहीं है।",
                  )}
                </p>
              )}
            </section>
          )}
          {user.role === "admin" && !c.department_id && (
            <section className="action-panel">
              <h3>{t("Allocate to a department", "विभाग को आवंटित करें")}</h3>
              <Field label={t("Department", "विभाग")}>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  {catalog.departments
                    .filter((d) => d.id !== "general")
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {t(d.en, d.hi)}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label={t("Allocation remark", "आवंटन टिप्पणी")}>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  maxLength={1000}
                />
              </Field>
              <button
                className="primary"
                disabled={busy || remarks.trim().length < 3}
                onClick={() =>
                  action("/allocate", { department_id: department, remarks })
                }
              >
                {t("Allocate complaint", "शिकायत आवंटित करें")}
              </button>
            </section>
          )}
          {sop && (
            <section className="sop-view">
              <div className="section-heading">
                <h3>{t("SOP reference", "SOP संदर्भ")}</h3>
                <button className="text-button" onClick={() => setSop(null)}>
                  {t("Hide", "छिपाएं")}
                </button>
              </div>
              <p>
                <code>{c.estimate.sop_ref}</code>
              </p>
              <pre>{sop.text}</pre>
            </section>
          )}
        </>
      )}
    </Modal>
  );
}
