import React, { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Bell,
  Megaphone,
  Users,
  LogOut,
  Plus,
  ArrowUpRight,
  CircleHelp,
  Globe2,
  Sprout,
} from "lucide-react";
import { api, post } from "./api";
import { Language, ErrorBox, useText } from "./ui";
import Login, { Profile } from "./Login";
import Complaints from "./Complaints";
import Intake from "./Intake";
import ComplaintDetail from "./ComplaintDetail";
import { Notices, Updates, Officers } from "./Management";

function Shell({ language, setLanguage }) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const t = useText(),
    [user, setUser] = useState(null),
    [catalog, setCatalog] = useState(null),
    [health, setHealth] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [page, setPage] = useState("complaints"),
    [creating, setCreating] = useState(false),
    [selected, setSelected] = useState(null),
    [version, setVersion] = useState(0),
    [unread, setUnread] = useState(0);
  useEffect(() => {
    Promise.all([
      api("/catalog"),
      api("/health"),
      sessionStorage.getItem("samadhan.session")
        ? api("/me").catch(() => {
            sessionStorage.removeItem("samadhan.session");
            return null;
          })
        : Promise.resolve(null),
    ])
      .then(([c, h, u]) => {
        setCatalog(c);
        setHealth(h);
        setUser(u);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const read = () =>
      api("/updates")
        .then((u) => active && setUnread(u.filter((x) => !x.is_read).length))
        .catch(() => {});
    read();
    const timer = setInterval(read, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user, version]);
  useEffect(() => {
  if (!profileMenuOpen) return;

  function handleOutsideClick(event) {
    if (
      profileMenuRef.current &&
      !profileMenuRef.current.contains(event.target)
    ) {
      setProfileMenuOpen(false);
    }
  }

  function handleEscape(event) {
    if (event.key === "Escape") {
      setProfileMenuOpen(false);
    }
  }

  document.addEventListener("pointerdown", handleOutsideClick);
  document.addEventListener("keydown", handleEscape);

  return () => {
    document.removeEventListener("pointerdown", handleOutsideClick);
    document.removeEventListener("keydown", handleEscape);
  };
}, [profileMenuOpen]);
  const refresh = () => setVersion((v) => v + 1);
    async function logout() {
    setProfileMenuOpen(false);

    await post("/auth/logout").catch(() => {});
    sessionStorage.removeItem("samadhan.session");

    setUser(null);
    setCreating(false);
    setSelected(null);
    setPage("complaints");
  }
  const nav = [
    ["complaints", LayoutDashboard, t("Complaints", "शिकायतें")],
    ...(user?.role === "admin"
      ? [["officers", Users, t("Officers", "अधिकारी")]]
      : []),
    ["updates", Bell, t("Updates", "अपडेट")],
    ["notices", Megaphone, t("Notices", "सूचनाएँ")],
  ];
  return (
    <>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Samadhan AI">
          <span className="brand-mark">
            <Sprout size={25} />
          </span>
          <span>
            samadhan<span className="brand-ai">AI</span>
            <small>{t("A BETTER EVERYDAY", "बेहतर कल की ओर")}</small>
          </span>
        </a>
        <div className="header-right">
          <span className="prototype-tag">
            {t("Submission prototype", "प्रस्तुति प्रोटोटाइप")}
          </span>
          <div className="language-switch">
            <Globe2 size={16} />
            <button
              className={language === "en" ? "active" : ""}
              onClick={() => setLanguage("en")}
            >
              EN
            </button>
            <button
              className={language === "hi" ? "active" : ""}
              onClick={() => setLanguage("hi")}
            >
              हिंदी
            </button>
          </div>
          {user && (
            <div className="user-menu" ref={profileMenuRef}>
              <button
                type="button"
                className="avatar"
                title={t("Account menu", "खाता मेनू")}
                aria-label={t("Open account menu", "खाता मेनू खोलें")}
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((open) => !open)}
              >
                {user.name?.trim()?.slice(0, 1).toUpperCase() || "S"}
              </button>

              {profileMenuOpen && (
                <div className="user-menu-popover" role="menu">
                  <div className="user-menu-info">
                    <strong>
                      {user.name || user.username || t("User", "उपयोगकर्ता")}
                    </strong>
                    <small>
                      {user.role === "admin"
                        ? t("Administrator", "प्रशासक")
                        : user.role === "officer"
                          ? t("Officer", "अधिकारी")
                          : t("Citizen", "नागरिक")}
                    </small>
                  </div>

                  <button
                    type="button"
                    className="user-menu-logout"
                    role="menuitem"
                    onClick={logout}
                  >
                    <LogOut size={17} />
                    {t("Sign out", "साइन आउट")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      {loading ? (
        <div className="loading">
          {t("Getting things ready…", "तैयारी हो रही है…")}
        </div>
      ) : error ? (
        <div className="page">
          <ErrorBox message={error} />
          <button onClick={() => location.reload()}>
            {t("Retry connection", "फिर कोशिश करें")}
          </button>
        </div>
      ) : !user ? (
        <Login onLogin={setUser} health={health} />
      ) : user.role === "citizen" && (!user.name || !user.district) ? (
        <Profile user={user} catalog={catalog} onDone={setUser} />
      ) : (
        <div className="workspace">
          <aside className="sidebar">
            <div className="workspace-label">
              {t(
                user.role === "citizen"
                  ? "CITIZEN WORKSPACE"
                  : user.role === "officer"
                    ? "OFFICER WORKSPACE"
                    : "ADMIN WORKSPACE",
                user.role === "citizen"
                  ? "नागरिक कार्यक्षेत्र"
                  : user.role === "officer"
                    ? "अधिकारी कार्यक्षेत्र"
                    : "प्रशासक कार्यक्षेत्र",
              )}
            </div>
            <nav>
              {nav.map(([key, Icon, label]) => (
                <button
                  key={key}
                  className={page === key && !creating ? "selected" : ""}
                  onClick={() => {
                    setPage(key);
                    setCreating(false);
                  }}
                >
                  <Icon size={19} />
                  {label}
                  {key === "updates" && unread > 0 && (
                    <span className="unread-count">{unread}</span>
                  )}
                </button>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <div className="local-card">
                <span className="online-dot" />
                <b>{user.district || t("All districts", "सभी जिले")}</b>
                <small>
                  {user.role === "admin"
                    ? t("All departments", "सभी विभाग")
                    : user.role === "officer"
                      ? t(
                          catalog.departments.find(
                            (d) => d.id === user.department_id,
                          )?.en,
                          catalog.departments.find(
                            (d) => d.id === user.department_id,
                          )?.hi,
                        )
                      : user.locality}
                </small>
              </div>
              <button className="logout" onClick={logout}>
                <LogOut size={17} />
                {t("Sign out", "साइन आउट")}
              </button>
            </div>
          </aside>
          <main className="main-content">
            {creating ? (
              <Intake
                user={user}
                catalog={catalog}
                health={health}
                onCancel={() => setCreating(false)}
                onSubmitted={(c) => {
                  setCreating(false);
                  setSelected(c.id);
                  refresh();
                }}
              />
            ) : (
              <>
                {page === "complaints" && (
                  <Complaints
                    user={user}
                    catalog={catalog}
                    version={version}
                    onNew={() => setCreating(true)}
                    onOpen={setSelected}
                  />
                )}{" "}
                {page === "notices" && <Notices user={user} />}{" "}
                {page === "updates" && (
                  <Updates
                    user={user}
                    catalog={catalog}
                    onOpen={setSelected}
                    refresh={refresh}
                  />
                )}{" "}
                {page === "officers" && <Officers catalog={catalog} />}
              </>
            )}
            <footer>
              {t(
                "Samadhan AI · Made for clearer communication and better local services.",
                "समाधान AI · स्पष्ट संवाद और बेहतर स्थानीय सेवाओं के लिए।",
              )}
              <span>
                {t(
                  "Prototype estimates · Not an official portal",
                  "प्रोटोटाइप अनुमान · आधिकारिक पोर्टल नहीं",
                )}
              </span>
            </footer>
          </main>
        </div>
      )}
      {selected && (
        <ComplaintDetail
          id={selected}
          user={user}
          catalog={catalog}
          onClose={() => setSelected(null)}
          onChange={refresh}
        />
      )}
    </>
  );
}
export default function App() {
  const [language, setLanguage] = useState(
    localStorage.getItem("samadhan.language") || "en",
  );
  useEffect(() => {
    localStorage.setItem("samadhan.language", language);
    document.documentElement.lang = language;
  }, [language]);
  return (
    <Language.Provider value={language}>
      <Shell language={language} setLanguage={setLanguage} />
    </Language.Provider>
  );
}
