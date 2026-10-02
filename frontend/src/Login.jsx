import React, { useState } from "react";
import {
  ArrowRight,
  ShieldCheck,
  Phone,
  MapPin,
  Check,
  MessageSquare,
  Mic,
  UserRound,
  LockKeyhole,
} from "lucide-react";
import { post, put } from "./api";
import { ErrorBox, Field, useText } from "./ui";
export function Profile({ user, catalog, onDone }) {
  const t = useText(),
    [form, setForm] = useState({
      name: user.name || "",
      district: user.district || "Bhopal",
      locality: user.locality || "Bhopal City",
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const set = (key, value) => setForm({ ...form, [key]: value });
  return (
    <div className="profile-wrap">
      <div className="panel profile">
        <span className="eyebrow">{t("ONE LAST STEP", "एक अंतिम चरण")}</span>
        <h1>{t("Let’s make it local.", "अपना क्षेत्र चुनें।")}</h1>
        <p className="muted">
          {t(
            "Your details help us connect your complaint to the right district.",
            "आपकी जानकारी से शिकायत सही जिले तक पहुँचेगी।",
          )}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              onDone(await put("/me", form));
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label={t("Your name", "आपका नाम")}>
            <input
              required
              minLength={2}
              maxLength={80}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label={t("District", "जिला")}>
            <select
              value={form.district}
              onChange={(e) =>
                setForm({
                  ...form,
                  district: e.target.value,
                  locality: catalog.districts.find(
                    (d) => d.id === e.target.value,
                  ).localities[0].id,
                })
              }
            >
              {catalog.districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {t(d.en, d.hi)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("City / town / village", "शहर / कस्बा / गाँव")}>
            <select
              value={form.locality}
              onChange={(e) => set("locality", e.target.value)}
            >
              {catalog.districts
                .find((d) => d.id === form.district)
                .localities.map((p) => (
                  <option key={p.id} value={p.id}>
                    {t(p.en, p.hi)}
                  </option>
                ))}
            </select>
          </Field>
          <ErrorBox message={error} />
          <button disabled={busy} className="primary full">
            {t("Continue to dashboard", "डैशबोर्ड खोलें")}
            <ArrowRight size={17} />
          </button>
        </form>
      </div>
    </div>
  );
}
export default function Login({ onLogin }) {
  const t = useText(),
    [portal, setPortal] = useState("citizen"),
    [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [sent, setSent] = useState(false),
    [fallbackCode, setFallbackCode] = useState(""),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function citizenLogin(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!sent) {
        const r = await post("/auth/request-otp", { phone });
        setFallbackCode(r.fallback_code || "");
        setSent(true);
      } else {
        const r = await post("/auth/verify-otp", { phone, code });
        sessionStorage.setItem("samadhan.session", r.token);
        onLogin(r.user);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function staffLogin(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await post("/auth/staff-login", { username, password });
      sessionStorage.setItem("samadhan.session", r.token);
      onLogin(r.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function switchPortal(next) {
    setPortal(next);
    setError("");
    setSent(false);
    setCode("");
    setFallbackCode("");
  }
  return (
    <main className="login-layout">
      <section className="login-story">
        <div className="kicker">
          <span />
          {t("SMALL CONCERNS. REAL CHANGE.", "आपकी बात। बेहतर बदलाव।")}
        </div>
        <h1>
          {t("A better everyday,", "बेहतर कल,")}
          <br />
          <em>{t("starts with you.", "आपसे शुरू।")}</em>
        </h1>
        <p>
          {t(
            "A broken streetlight. An uneven road. A service that needs attention. Let’s get your concern to the people who can help.",
            "बंद स्ट्रीट लाइट, खराब सड़क या कोई सेवा संबंधी समस्या। अपनी बात उस विभाग तक पहुँचाएँ जो मदद कर सके।",
          )}
        </p>
        <div className="story-steps">
          {[
            [MessageSquare, "Tell us the issue", "समस्या बताएं"],
            [MapPin, "We connect your department", "सही विभाग तक पहुँचाएँ"],
            [Check, "You confirm the resolution", "समाधान की पुष्टि करें"],
          ].map(([Icon, en, hi], i) => (
            <div key={en}>
              <span className="step-icon">
                <Icon size={19} />
              </span>
              <span>{t(en, hi)}</span>
              <small>0{i + 1}</small>
            </div>
          ))}
        </div>
        <div className="language-note">
          <Mic size={18} />
          {t(
            "Type in English. Speak in Hindi. Stay informed.",
            "हिंदी में बोलें। अंग्रेज़ी में लिखें। स्थिति जानते रहें।",
          )}
        </div>
      </section>
      <section className="login-card">
        <span className="welcome-icon">
          <ShieldCheck size={27} />
        </span>
        <h2>{t("Welcome to Samadhan", "समाधान में स्वागत है")}</h2>
        <p className="muted">
          {portal === "citizen"
            ? t("Citizen access with mobile verification.", "मोबाइल सत्यापन से नागरिक प्रवेश।")
            : t("Secure access for officers and administrators.", "अधिकारियों और प्रशासकों के लिए सुरक्षित प्रवेश।")}
        </p>
        <div className="login-tabs" role="tablist" aria-label={t("Choose login type", "लॉगिन प्रकार चुनें")}>
          <button type="button" role="tab" aria-selected={portal === "citizen"}
            className={portal === "citizen" ? "active" : ""} onClick={() => switchPortal("citizen")}>
            <Phone size={17} /> {t("Citizen", "नागरिक")}
          </button>
          <button type="button" role="tab" aria-selected={portal === "staff"}
            className={portal === "staff" ? "active" : ""} onClick={() => switchPortal("staff")}>
            <ShieldCheck size={17} /> {t("Officer / Admin", "अधिकारी / प्रशासक")}
          </button>
        </div>
        {portal === "citizen" ? (
        <form onSubmit={citizenLogin}>
          <Field label={t("Mobile number", "मोबाइल नंबर")}>
            <div className="phone-input">
              <span>+91</span>
              <input
                aria-label={t("Mobile number", "मोबाइल नंबर")}
                required
                type="tel"
                inputMode="numeric"
                pattern="[6-9][0-9]{9}"
                maxLength={10}
                placeholder="98765 43210"
                value={phone}
                disabled={sent}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </Field>
          {sent && fallbackCode && (
            <div className="otp-fallback" role="status">
              <small>{t("Temporary on-screen OTP", "अस्थायी ऑन-स्क्रीन OTP")}</small>
              <strong>{fallbackCode}</strong>
              <span>{t("Valid for 5 minutes", "5 मिनट तक मान्य")}</span>
            </div>
          )}
          {sent && (
            <Field
              label={t("6-digit verification code", "6 अंकों का सत्यापन कोड")}
            >
              <input
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </Field>
          )}
          <ErrorBox message={error} />
          <button className="primary full" disabled={busy}>
            {busy
              ? t("Please wait…", "कृपया प्रतीक्षा करें…")
              : sent
                ? t("Verify & continue", "सत्यापित करें और आगे बढ़ें")
                : t("Send verification code", "सत्यापन कोड भेजें")}
            <ArrowRight size={18} />
          </button>
          {sent && (
            <button
              type="button"
              className="text-button full"
              onClick={() => {
                setSent(false);
                setCode("");
                setFallbackCode("");
                setError("");
              }}
            >
              {t(
                "Change number / request another code",
                "नंबर बदलें / नया कोड लें",
              )}
            </button>
          )}
        </form>
        ) : (
        <form onSubmit={staffLogin}>
          <Field label={t("Username", "उपयोगकर्ता नाम")}>
            <div className="credential-input">
              <UserRound size={18} />
              <input aria-label={t("Username", "उपयोगकर्ता नाम")} required
                autoComplete="username" minLength={3} maxLength={40}
                value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
          </Field>
          <Field label={t("Password", "पासवर्ड")}>
            <div className="credential-input">
              <LockKeyhole size={18} />
              <input aria-label={t("Password", "पासवर्ड")} required type="password"
                autoComplete="current-password" maxLength={128}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </Field>
          <ErrorBox message={error} />
          <button className="primary full" disabled={busy}>
            {busy ? t("Signing in…", "प्रवेश हो रहा है…") : t("Sign in to staff portal", "स्टाफ पोर्टल में प्रवेश करें")}
            <ArrowRight size={18} />
          </button>
        </form>
        )}
        <div className="secure-note">
          <ShieldCheck size={15} />
          {t(
            "Your complaints are visible only to you and authorised staff.",
            "आपकी शिकायत केवल आपको और अधिकृत कर्मचारियों को दिखाई देगी।",
          )}
        </div>
      </section>
    </main>
  );
}
