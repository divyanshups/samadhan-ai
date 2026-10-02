import React, { useContext, useEffect, useState } from "react";
import {
  Plus,
  Search,
  ArrowUpRight,
  ClipboardList,
  Clock3,
  CheckCircle2,
  MessageCircle,
  ArrowRight,
  SlidersHorizontal,
  AlertTriangle,
} from "lucide-react";
import { api, date } from "./api";
import { Language, useText, Badge, Empty, ErrorBox, statusNames } from "./ui";
export default function Complaints({ user, catalog, version, onNew, onOpen }) {
  const t = useText(),
    lang = useContext(Language),
    [items, setItems] = useState([]),
    [analytics, setAnalytics] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState("");
  useEffect(() => {
    let active = true;
    const load = () =>
      Promise.all([
        api("/complaints"),
        user.role === "admin" ? api("/analytics") : Promise.resolve(null),
      ])
        .then(([c, a]) => {
          if (active) {
            setItems(c);
            setAnalytics(a);
            setError("");
          }
        })
        .catch((e) => active && setError(e.message))
        .finally(() => active && setLoading(false));
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [version, user.role]);
  const visible = items.filter(
    (c) =>
      (filter === "all" ||
        (filter === "open" && !["COMPLETED", "RESOLVED"].includes(c.status)) ||
        (filter === "review" && c.status === "COMPLETED") ||
        (filter === "resolved" && c.status === "RESOLVED") ||
        (filter === "unallocated" && !c.department_id)) &&
      (c.id + " " + c.data.issue_description + " " + c.locality)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const stats = [
    [
      ClipboardList,
      t("Total complaints", "कुल शिकायतें"),
      items.length,
      "neutral",
    ],
    [
      Clock3,
      t("In progress", "प्रक्रिया में"),
      items.filter((c) =>
        ["SUBMITTED", "ASSIGNED", "IN_PROGRESS"].includes(c.status),
      ).length,
      "amber",
    ],
    [
      MessageCircle,
      t("Awaiting review", "समीक्षा की प्रतीक्षा"),
      items.filter((c) => c.status === "COMPLETED").length,
      "purple",
    ],
    [
      CheckCircle2,
      t("Resolved", "हल हो गई"),
      items.filter((c) => c.status === "RESOLVED").length,
      "green",
    ],
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="breadcrumb">
            {t("WORKSPACE", "कार्यक्षेत्र")} <span>/</span>{" "}
            {t("OVERVIEW", "अवलोकन")}
          </div>
          <h1>
            {user.role === "citizen"
              ? t(
                  "Hello, " + user.name.split(" ")[0] + ".",
                  "नमस्ते, " + user.name.split(" ")[0] + "।",
                )
              : t(
                  user.role === "admin"
                    ? "A clearer view of your city."
                    : "Let’s move things forward.",
                  user.role === "admin"
                    ? "अपने शहर की स्पष्ट तस्वीर।"
                    : "आइए काम आगे बढ़ाएँ।",
                )}
          </h1>
          <p>
            {t(
              user.role === "citizen"
                ? "Your concerns, progress, and next steps. All in one place."
                : user.role === "officer"
                  ? "Manage your department’s complaints and keep citizens informed."
                  : "Monitor complaints, allocation, and department progress.",
              "शिकायतें, प्रगति और अगले कदम — सब एक जगह।",
            )}
          </p>
        </div>
        {user.role === "citizen" && (
          <button className="primary" onClick={onNew}>
            <Plus size={18} />
            {t("New complaint", "नई शिकायत")}
          </button>
        )}
      </div>
      {user.role === "citizen" && (
        <section className="dashboard-banner">
          <div>
            <span className="eyebrow">
              {t("YOUR VOICE MATTERS", "आपकी आवाज़ मायने रखती है")}
            </span>
            <h2>
              {t(
                "Better neighbourhoods begin with a conversation.",
                "बेहतर मोहल्ले की शुरुआत एक बातचीत से।",
              )}
            </h2>
            <p>
              {t(
                "Tell us what needs attention. We’ll help you take the next step.",
                "बताइए कहाँ ध्यान देने की ज़रूरत है। हम अगला कदम लेने में मदद करेंगे।",
              )}
            </p>
            <button className="banner-link" onClick={onNew}>
              {t("Start a complaint", "शिकायत शुरू करें")}
              <ArrowRight size={17} />
            </button>
          </div>
          <div className="banner-art" aria-hidden="true">
            <div className="art-disc">
              <MessageCircle size={60} strokeWidth={1.3} />
            </div>
            <span className="art-check">
              <CheckCircle2 size={28} />
            </span>
            <span className="art-lines">
              <i />
              <i />
              <i />
            </span>
          </div>
        </section>
      )}
      <div className="stats-grid">
        {stats.map(([Icon, label, value, color]) => (
          <section className="stat-card" key={label}>
            <div>
              <span>{label}</span>
              <strong>{value.toString().padStart(2, "0")}</strong>
            </div>
            <span className={"stat-icon " + color}>
              <Icon size={22} />
            </span>
          </section>
        ))}
      </div>
      {analytics && (
        <section className="analytics-panel panel">
          <div className="section-heading">
            <div>
              <h3>{t("Service overview", "सेवा अवलोकन")}</h3>
              <p className="muted">
                {t(
                  "Live counts from submitted complaints",
                  "दर्ज शिकायतों से वर्तमान आँकड़े",
                )}
              </p>
            </div>
            <span className="badge submitted">
              {analytics.needs_allocation} {t("need allocation", "आवंटन बाकी")}
            </span>
          </div>
          <div className="analytics-grid">
            <div>
              <h4>{t("By department", "विभाग अनुसार")}</h4>
              {analytics.departments
                .filter((d) => d.count)
                .map((d) => (
                  <div className="bar-row" key={d.id}>
                    <span>
                      {t(
                        catalog.departments.find((x) => x.id === d.id)?.en,
                        catalog.departments.find((x) => x.id === d.id)?.hi,
                      )}
                    </span>
                    <div>
                      <i
                        style={{
                          width:
                            (d.count / Math.max(analytics.total, 1)) * 100 +
                            "%",
                        }}
                      />
                    </div>
                    <b>{d.count}</b>
                  </div>
                ))}
              {!analytics.total && (
                <p className="muted">
                  {t(
                    "Charts appear after the first complaint.",
                    "पहली शिकायत के बाद आँकड़े दिखेंगे।",
                  )}
                </p>
              )}
            </div>
            <div>
              <h4>{t("By district", "जिले अनुसार")}</h4>
              {analytics.districts.map((d) => (
                <div className="bar-row" key={d.label}>
                  <span>{d.label}</span>
                  <div>
                    <i
                      style={{
                        width:
                          (d.count / Math.max(analytics.total, 1)) * 100 + "%",
                      }}
                    />
                  </div>
                  <b>{d.count}</b>
                </div>
              ))}
            </div>
            <div className="analytics-facts">
              <p>
                <span>{t("Overdue", "समय सीमा पार")}</span>
                <b>{analytics.overdue}</b>
              </p>
              <p>
                <span>{t("Reopened", "फिर खोली गई")}</span>
                <b>{analytics.reopened}</b>
              </p>
              <p>
                <span>{t("Average resolution", "औसत समाधान")}</span>
                <b>
                  {analytics.average_resolution_days ?? "—"} {t("days", "दिन")}
                </b>
              </p>
            </div>
          </div>
        </section>
      )}
      <section className="panel complaint-panel">
        <div className="section-heading">
          <div>
            <h2>
              {t(
                user.role === "citizen" ? "Your complaints" : "Complaints",
                user.role === "citizen" ? "आपकी शिकायतें" : "शिकायतें",
              )}{" "}
              <span className="count-label">{items.length}</span>
            </h2>
            <p className="muted">
              {t(
                "Follow every step, from submission to resolution.",
                "दर्ज होने से समाधान तक हर कदम देखें।",
              )}
            </p>
          </div>
          <span className="live-label">
            <i />
            {t("Auto-updating", "अपने आप अपडेट")}
          </span>
        </div>
        <div className="list-controls">
          <div className="tabs">
            {[
              ["all", "All", "सभी"],
              ["open", "Open", "खुली"],
              ["review", "Needs review", "समीक्षा"],
              ["resolved", "Resolved", "हल"],
              ...(user.role === "admin"
                ? [["unallocated", "Unallocated", "अनावंटित"]]
                : []),
            ].map(([v, en, hi]) => (
              <button
                key={v}
                className={filter === v ? "active" : ""}
                onClick={() => setFilter(v)}
              >
                {t(en, hi)}
              </button>
            ))}
          </div>
          <div className="search">
            <Search size={17} />
            <input
              aria-label={t("Search complaints", "शिकायत खोजें")}
              placeholder={t("Search complaint or ID", "शिकायत या ID खोजें")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <ErrorBox message={error} />
        {loading ? (
          <div className="loading">
            {t("Loading complaints…", "शिकायतें लोड हो रही हैं…")}
          </div>
        ) : visible.length ? (
          <div className="complaint-list">
            {visible.map((c) => {
              const cat = catalog.categories.find(
                  (x) => x.id === c.category_id,
                ),
                dept = catalog.departments.find(
                  (x) => x.id === c.department_id,
                );
              return (
                <button
                  className="complaint-row"
                  key={c.id}
                  onClick={() => onOpen(c.id)}
                >
                  <div className="complaint-symbol">
                    <ClipboardList size={21} />
                  </div>
                  <div className="complaint-main">
                    <div className="complaint-meta">
                      <span>{c.id}</span>
                      <i>·</i>
                      <span>{date(c.created_at, lang)}</span>
                    </div>
                    <h3>{c.data.issue_description}</h3>
                    <p>
                      {t(cat?.en, cat?.hi)} <span>·</span> {c.locality}
                    </p>
                  </div>
                  <div className="complaint-state">
                    <Badge status={c.status} />
                    <small>
                      {!dept ? (
                        t("Needs department allocation", "विभाग आवंटन बाकी")
                      ) : c.overdue ? (
                        <span className="overdue">
                          {t("Estimate overdue", "अनुमानित समय पार")}
                        </span>
                      ) : (
                        t(dept.en, dept.hi)
                      )}
                    </small>
                  </div>
                  <ArrowUpRight className="row-arrow" size={20} />
                </button>
              );
            })}
          </div>
        ) : (
          <Empty title={t("Nothing here yet", "अभी कोई शिकायत नहीं")}>
            {search || filter !== "all"
              ? t("Try a different search or filter.", "खोज या फ़िल्टर बदलें।")
              : t(
                  "Start a complaint and follow its progress here.",
                  "शिकायत शुरू करें और यहाँ उसकी प्रगति देखें।",
                )}
          </Empty>
        )}
      </section>
      <div className="bottom-note">
        <CheckCircle2 size={18} />
        {t(
          "You have the final say. Confirm whether the issue is resolved when work is completed.",
          "अंतिम पुष्टि आपकी है। काम पूरा होने पर बताएं कि समस्या हल हुई या नहीं।",
        )}
      </div>
    </>
  );
}
