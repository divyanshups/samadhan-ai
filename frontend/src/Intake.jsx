import React, { useContext, useEffect, useRef, useState } from "react";
import Vapi from "@vapi-ai/web";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Mic,
  MicOff,
  Send,
  MessageCircle,
  FileText,
  Upload,
  MapPin,
  Sparkles,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { api, post, patch, remove } from "./api";
import { Language, useText, Field, ErrorBox, ImageView } from "./ui";
const questions = {
  issue_description: [
    "What issue would you like to complain about? Please describe it here.",
    "आप किस समस्या की शिकायत करना चाहते हैं? कृपया अपनी समस्या बताइए।",
  ],
  house_or_landmark: [
    "What is the house number, house name, or nearest landmark at the issue location?",
    "समस्या वाली जगह का मकान नंबर, मकान का नाम या नज़दीकी पहचान का स्थान क्या है?",
  ],
  area: [
    "What is the area or neighbourhood name?",
    "उस जगह के क्षेत्र या मोहल्ले का नाम क्या है?",
  ],
  ward: [
    "What is the ward number? If you don't know, type 'I don't know'.",
    "उस जगह का वार्ड नंबर क्या है? नहीं पता हो तो “नहीं पता” लिखें।",
  ],
  issue_duration_or_start_date: [
    "Since when have you been facing this issue?",
    "आपको यह समस्या कब से हो रही है?",
  ],
  category_id: [
    "Please select the correct issue category from the options below.",
    "कृपया नीचे दी गई सूची से अपनी शिकायत की सही श्रेणी चुनें।",
  ],
  remarks: [
    "Would you like to add any other remarks? You can also skip this.",
    "क्या आप कोई और जानकारी या टिप्पणी जोड़ना चाहेंगे? आप इसे छोड़ भी सकते हैं।",
  ],
  preview: [
    "Your draft is ready. Add the mandatory pincode and an optional photo in preview. Please check the details before submitting.",
    "आपका ड्राफ्ट तैयार है। प्रीव्यू में अनिवार्य पिनकोड और वैकल्पिक तस्वीर जोड़ें। जमा करने से पहले जानकारी जाँचें।",
  ],
};
const fieldLabels = {
  issue_description: ["Issue description", "समस्या का विवरण"],
  house_or_landmark: ["House / landmark", "मकान / पहचान का स्थान"],
  area: ["Area / neighbourhood", "क्षेत्र / मोहल्ला"],
  ward: ["Ward number (optional)", "वार्ड नंबर (वैकल्पिक)"],
  issue_duration_or_start_date: ["Since when?", "समस्या कब से है?"],
  remarks: ["Additional remarks (optional)", "अतिरिक्त टिप्पणी (वैकल्पिक)"],
};

export function CategorySelect({ catalog, value, onChange, suggested = [], disabled = false }) {
  const t = useText();
  return (
    <select
      required
      disabled={disabled}
      aria-label={t("Issue category", "शिकायत श्रेणी")}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{t("Choose a category", "श्रेणी चुनें")}</option>
      {suggested.length > 0 && (
        <optgroup
          label={t("Suggested for your issue", "आपकी समस्या के लिए सुझाव")}
        >
          {suggested
            .map((id) => catalog.categories.find((c) => c.id === id))
            .filter(Boolean)
            .map((c) => (
              <option value={c.id} key={c.id}>
                {t(c.en, c.hi)}
              </option>
            ))}
        </optgroup>
      )}
      {catalog.departments.map((d) => (
        <optgroup key={d.id} label={t(d.en, d.hi)}>
          {catalog.categories
            .filter((c) => c.department_id === d.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {t(c.en, c.hi)}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

export default function Intake({
  user,
  catalog,
  health,
  onSubmitted,
  onCancel,
}) {
  const language = useContext(Language),
    t = useText(),
    [draft, setDraft] = useState(null),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false),
    [voiceState, setVoiceState] = useState("idle"),
    [categoryOpen, setCategoryOpen] = useState(false),
    [transcript, setTranscript] = useState([]),
    [mode, setMode] = useState(health.chat_configured ? "ai" : "guided");
  const voice = useRef(null),
    draftId = useRef(null),
    end = useRef(null),
    categoryBox = useRef(null),
    [typing, setTyping] = useState(language !== "hi");
  const showCategories = !!draft && Boolean(
    categoryOpen || draft.category_requested || draft.stage === "category_id"
  );
  function acceptDraft(value) {
    if (value.id !== draftId.current) return;
    setDraft((old) => (!old || value.revision >= old.revision ? value : old));
  }
  useEffect(() => {
    let active = true;
    post("/drafts")
      .then((d) => {
        if (active) {
          setDraft(d);
          draftId.current = d.id;
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
      voice.current?.stop();
      if (draftId.current)
        remove("/drafts/" + draftId.current + "/voice-session").catch(() => {});
      draftId.current = null;
    };
  }, []);
  useEffect(() => {
    if (!draft || voiceState === "idle" || preview) return;
    const timer = setInterval(
      () =>
        api("/drafts/" + draft.id)
          .then(acceptDraft)
          .catch((e) => setError(e.message)),
      1400,
    );
    return () => clearInterval(timer);
  }, [draft?.id, voiceState, preview]);
  useEffect(() => {
    if (!showCategories)
      end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [draft?.messages?.length, transcript.length, showCategories]);
  useEffect(() => {
    if (showCategories && !preview) {
      categoryBox.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      categoryBox.current?.querySelector("select")?.focus({ preventScroll: true });
    }
  }, [showCategories, preview]);
  async function stop() {
    voice.current?.stop();
    setVoiceState("idle");
    if (draft)
      await remove("/drafts/" + draft.id + "/voice-session").catch(() => {});
  }
  async function start() {
    setTyping(false);
    setTranscript([]);
    setError("");
    setVoiceState("connecting");
    try {
      const session = await post("/drafts/" + draft.id + "/voice-session");
      const v = new Vapi(session.public_key);
      voice.current = v;
      v.on("call-start", () => setVoiceState("active"));
      v.on("call-end", () => {
        setVoiceState("idle");
        api("/drafts/" + draft.id)
          .then(acceptDraft)
          .catch(() => {});
      });
      v.on("error", () => {
        setError(
          t(
            "Voice connection failed. Check microphone permission and Vapi configuration, or continue by typing.",
            "वॉइस कनेक्शन नहीं हुआ। माइक्रोफोन अनुमति जाँचें या लिखकर जारी रखें।",
          ),
        );
        setVoiceState("idle");
      });
      v.on("message", (m) => {
        if (m.type === "transcript" && m.transcriptType === "final")
          setTranscript((old) => [
            ...old.slice(-29),
            { role: m.role, content: m.transcript },
          ]);
      });
      const call = await v.start(session.assistant_id, {
        variableValues: { draft_session: session.draft_session },
        firstMessage:
          draft.stage === "issue_description"
            ? questions.issue_description[1]
            : "हम आपकी अधूरी शिकायत की जानकारी आगे भरेंगे।",
      });
      if (!call) {
        setVoiceState("idle");
        setError(
          t(
            "Voice could not start. Please try again.",
            "वॉइस शुरू नहीं हुई। फिर कोशिश करें।",
          ),
        );
      }
    } catch (e) {
      setError(e.message);
      setVoiceState("idle");
    }
  }
  async function send(e, override) {
    e?.preventDefault();
    if (!draft || busy) return;
    const message = override ?? text;
    if (!message.trim()) return;
    setBusy(true);
    setError("");
    try {
      const d = await post("/drafts/" + draft.id + "/chat", {
        text: message,
        revision: draft.revision,
        language,
      });
      setDraft(d);
      setMode(d.mode);
      setText("");
    } catch (e) {
      setError(e.message);
      api("/drafts/" + draft.id)
        .then(acceptDraft)
        .catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  async function choose(id) {
    if (!id || busy) return;
    setBusy(true);
    setError("");
    try {
      const d = await patch("/drafts/" + draft.id, { category_id: id });
      acceptDraft(d);
      setCategoryOpen(false);
      if (voiceState === "active") {
        const c = catalog.categories.find((c) => c.id === id);
        voice.current?.send({
          type: "add-message",
          triggerResponseEnabled: true,
          message: {
            role: "user",
            content:
              "मैंने स्क्रीन पर यह श्रेणी चुनी है: " +
              c.hi +
              " (category_id: " +
              id +
              "). यह मेरा पुष्ट चयन है।",
          },
        });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function openPreview() {
    await stop();
    const latest = await api("/drafts/" + draft.id);
    setDraft(latest);
    setPreview(true);
  }
  async function discardDraft() {
    await stop();
    await remove("/drafts/" + draft.id);
    draftId.current = null;
    onCancel();
  }
  async function endChat(restart = false) {
    if (busy) return;
    const message = restart
      ? "Restart this chat? Your current answers will be discarded."
      : "Discard this chat and its draft? You will return to your complaints.";
    if (!window.confirm(message)) return;
    setBusy(true);
    setError("");
    try {
      if (restart) {
        await stop();
        const next = await post("/drafts/" + draft.id + "/restart");
        draftId.current = next.id;
        setDraft(next);
        setText("");
        setTranscript([]);
        setCategoryOpen(false);
        setTyping(true);
        setMode(health.chat_configured ? "ai" : "guided");
      } else {
        await discardDraft();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!draft)
    return (
      <div className="panel">
        <p>{t("Preparing your complaint…", "आपकी शिकायत तैयार हो रही है…")}</p>
        <ErrorBox message={error} />
      </div>
    );
  if (preview)
    return (
      <Preview
        draft={draft}
        user={user}
        catalog={catalog}
        onBack={() => setPreview(false)}
        onSubmitted={onSubmitted}
        onDiscard={discardDraft}
      />
    );
  const done = Object.keys(draft.data).filter((k) =>
    [...Object.keys(fieldLabels), "category_id"].includes(k),
  ).length;
  const messages = transcript.length && !typing ? transcript : draft.messages;
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const showCurrentQuestion =
    !lastAssistantMessage || lastAssistantMessage.stage !== draft.stage;
  return (
    <>
      <button className="back" onClick={onCancel}>
        <ArrowLeft size={17} />
        {t("Back to complaints", "शिकायतों पर वापस")}
      </button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {t("LET’S GET IT SORTED", "आइए समस्या दर्ज करें")}
          </span>
          <h1>{t("Tell us what’s happening.", "अपनी समस्या बताइए।")}</h1>
          <p>
            {t(
              "A few details now. A clearer path to resolution.",
              "कुछ जानकारी दें और समाधान की प्रगति जानें।",
            )}
          </p>
        </div>
        <span className="step-pill">
          {t("1 · Collect details → 2 · Review", "1 · जानकारी → 2 · समीक्षा")}
        </span>
      </div>
      <div className="intake-grid">
        <section className="panel conversation">
          {language === "en" && (
            <div className="chat-actions">
              <button className="secondary" disabled={busy} onClick={() => endChat(true)}>
                <RotateCcw size={16} /> Restart chat
              </button>
              <button className="danger-soft" disabled={busy} onClick={() => endChat()}>
                <Trash2 size={16} /> Discard chat
              </button>
            </div>
          )}
          <div className="conversation-title">
            <span className="assistant-icon">
              <Sparkles size={20} />
            </span>
            <div>
              <b>{t("Your complaint assistant", "आपका शिकायत सहायक")}</b>
              <small>
                {language === "hi"
                  ? t("Hindi voice & text", "हिंदी वॉइस और टेक्स्ट")
                  : mode === "ai"
                    ? t("Conversational AI", "संवादी AI")
                    : t("Guided form mode", "निर्देशित फ़ॉर्म मोड")}
              </small>
            </div>
            <span className="saved">
              {t("Draft saved", "ड्राफ्ट सुरक्षित")}
            </span>
          </div>
          {language === "hi" && (
            <div className="voice-panel">
              <div
                className={
                  "voice-orb " + (voiceState === "active" ? "listening" : "")
                }
              >
                <Mic size={29} />
              </div>
              <h3>
                {voiceState === "active"
                  ? "मैं सुन रही हूँ…"
                  : voiceState === "connecting"
                    ? "कनेक्ट हो रहा है…"
                    : "अपनी बात, अपनी भाषा में।"}
              </h3>
              <p>
                {t(
                  "Speak naturally. Your answers appear in the draft.",
                  "सहजता से बोलें। आपकी जानकारी ड्राफ्ट में भर जाएगी।",
                )}
              </p>
              {voiceState === "idle" ? (
                <button
                  className="primary"
                  disabled={!health.voice_configured || busy}
                  onClick={start}
                >
                  <Mic size={17} />
                  बोलकर शिकायत दर्ज करें
                </button>
              ) : (
                <button className="danger-soft" onClick={stop}>
                  <MicOff size={17} />
                  बातचीत बंद करें
                </button>
              )}
              {!health.voice_configured && (
                <small className="muted">
                  वॉइस अभी कॉन्फ़िगर नहीं है। नीचे लिखकर जानकारी भरें।
                </small>
              )}
              <button
                className="text-button"
                onClick={async () => {
                  await stop();
                  setTyping(!typing);
                }}
              >
                {typing ? "वॉइस दृश्य दिखाएं" : "लिखकर जारी रखें"}
              </button>
              {voiceState !== "idle" && (
                <button
                  className="secondary"
                  onClick={() => setCategoryOpen(true)}
                  disabled={busy || showCategories}
                  aria-controls="complaint-category-picker"
                  aria-expanded={Boolean(showCategories)}
                >
                  {draft.data.category_id ? "श्रेणी बदलें" : "श्रेणी चुनें"}
                </button>
              )}
            </div>
          )}
          <div className="chat-log" aria-live="polite">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  "bubble " + (m.role === "user" ? "user" : "assistant")
                }
              >
                {m.content}
              </div>
            ))}
            {showCurrentQuestion && (
              <div className="bubble assistant current">
                {t(...questions[draft.stage])}
              </div>
            )}
            <div ref={end} />
          </div>
          <ErrorBox message={error} />
          {showCategories ? (
            <div className="category-box" id="complaint-category-picker" ref={categoryBox}>
              <Field
                label={t(
                  "Confirm your issue category",
                  "अपनी शिकायत श्रेणी की पुष्टि करें",
                )}
              >
                <CategorySelect
                  catalog={catalog}
                  value={draft.data.category_id}
                  onChange={choose}
                  suggested={draft.suggested_category_ids}
                  disabled={busy}
                />
              </Field>
              <small className="muted">
                {t(
                  "Choose another department’s category if the suggestions do not fit.",
                  "सुझाव सही नहीं हों तो दूसरे विभाग की श्रेणी चुनें।",
                )}
              </small>
              {draft.data.category_id && (
                <button
                  className="text-button"
                  onClick={() => choose(draft.data.category_id)}
                  disabled={busy}
                >
                  {t("Keep this category", "यही श्रेणी रखें")}
                </button>
              )}
            </div>
          ) : draft.ready ? (
            <div className="ready-box">
              <CheckCircle2 size={24} />
              <p>
                {t(
                  "Ready for your review. Nothing is submitted yet.",
                  "समीक्षा के लिए तैयार। शिकायत अभी जमा नहीं हुई है।",
                )}
              </p>
              <button
                className="primary"
                onClick={() => openPreview().catch((e) => setError(e.message))}
              >
                {t("Proceed to Review Form", "फ़ॉर्म की समीक्षा के लिए आगे बढ़ें")}
                <ArrowRight size={17} />
              </button>
            </div>
          ) : (
            (language === "en" || typing || !health.voice_configured) && (
              <form className="chat-compose" onSubmit={send}>
                <textarea
                  aria-label={t("Your reply", "आपका उत्तर")}
                  placeholder={t("Type your reply…", "अपना उत्तर लिखें…")}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={busy || voiceState !== "idle"}
                  rows={2}
                  maxLength={3000}
                />
                <button
                  className="primary icon-button"
                  aria-label={t("Send reply", "उत्तर भेजें")}
                  disabled={busy || !text.trim() || voiceState !== "idle"}
                >
                  <Send size={18} />
                </button>
                {["ward", "remarks"].includes(draft.stage) && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy || voiceState !== "idle"}
                    onClick={() => send(null, "skip")}
                  >
                    {t("Skip", "छोड़ें")}
                  </button>
                )}
              </form>
            )
          )}
          {mode === "guided-fallback" && (
            <div className="info">
              {t(
                "AI is unavailable. Continuing in guided mode. Only validated answers are saved.",
                "AI उपलब्ध नहीं है। निर्देशित मोड में जारी है। केवल मान्य उत्तर सुरक्षित किए जाते हैं।",
              )}
            </div>
          )}
        </section>
        <aside className="draft-side">
          <div className="panel">
            <div className="section-heading">
              <h3>
                {t("Your draft, taking shape", "आपका तैयार होता ड्राफ्ट")}
              </h3>
              <FileText size={19} />
            </div>
            <div className="progress-track">
              <span style={{ width: Math.min((done / 7) * 100, 100) + "%" }} />
            </div>
            <small className="muted">
              {done}/7 {t("details collected", "जानकारियाँ भरी गईं")}
            </small>
            <dl>
              {Object.entries(fieldLabels).map(([key, labels]) => (
                <div key={key}>
                  <dt>{t(...labels)}</dt>
                  <dd>
                    {draft.data[key] ||
                      (key in draft.data
                        ? t("Not provided", "नहीं बताया गया")
                        : t("Waiting for your reply", "उत्तर की प्रतीक्षा"))}
                  </dd>
                </div>
              ))}
              <div>
                <dt>{t("Issue category", "श्रेणी")}</dt>
                <dd>
                  {draft.data.category_id
                    ? t(
                        catalog.categories.find(
                          (c) => c.id === draft.data.category_id,
                        )?.en,
                        catalog.categories.find(
                          (c) => c.id === draft.data.category_id,
                        )?.hi,
                      )
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>
          <div className="location-note">
            <MapPin size={19} />
            <div>
              <b>
                {user.locality}, {user.district}
              </b>
              <p>
                {t(
                  "Prefilled from your profile. You can change the issue location in preview.",
                  "प्रोफ़ाइल से लिया गया। प्रीव्यू में समस्या का स्थान बदल सकते हैं।",
                )}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function Preview({ draft, user, catalog, onBack, onSubmitted, onDiscard }) {
  const t = useText(),
    [form, setForm] = useState({
      ...draft.data,
      citizen_name: user.name,
      district: user.district,
      locality: user.locality,
      pincode: "",
      image_id: null,
      confirmed: false,
    }),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [discarding, setDiscarding] = useState(false),
    [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const category = catalog.categories.find((c) => c.id === form.category_id),
    dept = catalog.departments.find((d) => d.id === category?.department_id);
  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const data = new FormData();
      data.append("file", file);
      set(
        "image_id",
        (await api("/uploads", { method: "POST", body: data })).id,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    if (busy || uploading || discarding) return;
    setBusy(true);
    setError("");
    try {
      onSubmitted(await post("/drafts/" + draft.id + "/submit", form));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function discard() {
    if (busy || uploading || discarding) return;
    if (!window.confirm(t(
      "Discard this draft and your preview edits? No complaint will be submitted.",
      "इस ड्राफ्ट और प्रीव्यू में किए गए बदलावों को हटाएँ? शिकायत जमा नहीं होगी।",
    ))) return;
    setDiscarding(true);
    setError("");
    try {
      await onDiscard();
    } catch (e) {
      setError(e.message);
    } finally {
      setDiscarding(false);
    }
  }
  return (
    <>
      <button className="back" onClick={onBack} disabled={busy || uploading || discarding}>
        <ArrowLeft size={17} />
        {t("Back to conversation", "बातचीत पर वापस")}
      </button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {t("ONE FINAL LOOK", "एक बार जाँच लें")}
          </span>
          <h1>{t("Your complaint. Your say.", "आपकी शिकायत। आपकी पुष्टि।")}</h1>
          <p>
            {t(
              "Check the details, add your pincode, and submit when you’re ready.",
              "जानकारी जाँचें, पिनकोड भरें और फिर शिकायत जमा करें।",
            )}
          </p>
        </div>
        <span className="step-pill">
          {t("Step 2 of 2 · Review", "चरण 2 / 2 · समीक्षा")}
        </span>
      </div>
      <form className="preview-grid" onSubmit={submit}>
        <section className="panel form-panel">
          <h3>{t("Complaint details", "शिकायत का विवरण")}</h3>
          <Field label={t(...fieldLabels.issue_description)}>
            <textarea
              required
              value={form.issue_description || ""}
              maxLength={3000}
              onChange={(e) => set("issue_description", e.target.value)}
              rows={4}
            />
          </Field>
          <Field label={t("Issue category", "शिकायत श्रेणी")}>
            <CategorySelect
              catalog={catalog}
              value={form.category_id}
              onChange={(v) => set("category_id", v)}
            />
          </Field>
          <div className="form-two">
            {[
              "house_or_landmark",
              "area",
              "ward",
              "issue_duration_or_start_date",
            ].map((k) => (
              <Field key={k} label={t(...fieldLabels[k])}>
                <input
                  required={k !== "ward"}
                  maxLength={k === "ward" ? 80 : 200}
                  value={form[k] || ""}
                  onChange={(e) => set(k, e.target.value)}
                />
              </Field>
            ))}
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
            <Field label={t("Pincode *", "पिनकोड *")}>
              <input
                required
                inputMode="numeric"
                pattern="[1-9][0-9]{5}"
                maxLength={6}
                placeholder="462001"
                value={form.pincode}
                onChange={(e) =>
                  set("pincode", e.target.value.replace(/\D/g, ""))
                }
              />
            </Field>
            <Field label={t("Citizen name", "नागरिक का नाम")}>
              <input
                required
                minLength={2}
                maxLength={80}
                value={form.citizen_name}
                onChange={(e) => set("citizen_name", e.target.value)}
              />
            </Field>
          </div>
          <Field label={t(...fieldLabels.remarks)}>
            <textarea
              rows={3}
              maxLength={2000}
              value={form.remarks || ""}
              onChange={(e) => set("remarks", e.target.value)}
            />
          </Field>
          <div className="verified">
            <CheckCircle2 size={16} />
            {t("Verified mobile", "सत्यापित मोबाइल")}: +91 {user.phone}
          </div>
        </section>
        <aside>
          <section className="panel form-panel">
            <h3>{t("Add a little more context", "थोड़ा और संदर्भ दें")}</h3>
            <label className="upload-box">
              <Upload size={25} />
              <b>
                {uploading
                  ? t("Uploading…", "अपलोड हो रहा है…")
                  : t("Add a photo (optional)", "तस्वीर जोड़ें (वैकल्पिक)")}
              </b>
              <span>JPG, PNG, WebP · {t("up to 5 MB", "अधिकतम 5 MB")}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={upload}
                disabled={busy || uploading || discarding}
              />
            </label>
            {form.image_id && (
              <>
                <ImageView id={form.image_id} />
                <button
                  type="button"
                  className="text-button"
                  onClick={() => set("image_id", null)}
                >
                  {t("Remove photo", "तस्वीर हटाएं")}
                </button>
              </>
            )}
            <div className="routing-note">
              <small>{t("YOUR COMPLAINT GOES TO", "आपकी शिकायत जाएगी")}</small>
              <b>
                {category?.manual_allocation
                  ? t("Admin · department allocation", "प्रशासक · विभाग आवंटन")
                  : t(dept?.en, dept?.hi)}
              </b>
              <p>
                {t(
                  "The estimated timeline and SOP reference will appear after submission.",
                  "जमा करने के बाद अनुमानित समय और SOP संदर्भ दिखेगा।",
                )}
              </p>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                required
                checked={form.confirmed}
                onChange={(e) => set("confirmed", e.target.checked)}
              />
              <span>
                {t(
                  "I have reviewed these details and want to register this complaint.",
                  "मैंने जानकारी जाँच ली है और शिकायत दर्ज करना चाहता/चाहती हूँ।",
                )}
              </span>
            </label>
            <ErrorBox message={error} />
            <button
              className="primary full"
              disabled={busy || uploading || discarding || !form.confirmed}
            >
              {busy
                ? t("Submitting…", "जमा हो रहा है…")
                : t("Submit complaint", "शिकायत जमा करें")}
              <ArrowRight size={18} />
            </button>
            <button
              type="button"
              className="danger-soft full discard-preview"
              disabled={busy || uploading || discarding}
              onClick={discard}
            >
              <Trash2 size={17} />
              {discarding
                ? t("Discarding…", "ड्राफ्ट हटाया जा रहा है…")
                : t("Discard draft", "ड्राफ्ट हटाएँ")}
            </button>
          </section>
        </aside>
      </form>
    </>
  );
}
