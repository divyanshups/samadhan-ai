# Samadhan AI
Check the project demo here: [Click me](https://drive.google.com/file/d/1_EdXVo3panA1Mglhw3LQE1fwcwY7JKny/view?usp=sharing)

A bilingual citizen grievance portal that helps people register complaints, track progress, and receive updates in English or Hindi. Citizens can prepare a complaint through text intake or an optional Hindi voice assistant, review the details, and submit it to the appropriate department.

The application provides separate workspaces for citizens, officers, and administrators. It is a working prototype, with local SQLite storage and configurable AI services.

## Features

- **Bilingual interface:** English and Hindi across login, complaint registration, notices, and updates.
- **Complaint intake:** Step-by-step text collection, optional conversational AI, and Hindi voice assistance through Vapi.
- **Shared drafts:** Text and voice update the same complaint draft. Citizens can correct details, discard a draft, or restart before submission.
- **Review before submission:** Citizens select a category, enter a required six-digit pincode, and optionally attach a photo.
- **Department routing:** Most categories route to a predefined department. General grievances require administrator allocation.
- **Complaint tracking:** Status history, officer remarks, estimated timelines, and citizen feedback.
- **Staff management:** Administrators create and manage officer accounts, allocate unassigned complaints, send officer messages, and view analytics.
- **Notices and updates:** Staff publish notices; users receive relevant messages and complaint updates in the application.
- **SOP references:** The catalog contains 13 departments and 39 categories, with linked Markdown procedures and illustrative resolution estimates.

## User roles

| Role | Sign-in method | Main actions |
| --- | --- | --- |
| Citizen | Mobile number and on-screen OTP | Complete a profile, register complaints, track status, provide feedback, and read notices and updates |
| Officer | Username and password | Handle complaints within their district and department, assign responsible employees, update status, add remarks, and manage permitted notices |
| Administrator | Username and password | View complaints and analytics, allocate unassigned complaints, manage officers, send messages, and manage notices |

**OTP delivery is currently a prototype feature.** The code is displayed on the login screen; no SMS service is contacted. This flow does not verify ownership of the mobile number.

## Technology stack

| Component | Technology |
| --- | --- |
| Frontend | React 18, Vite 6, CSS, Lucide icons |
| Backend | Python, FastAPI, Uvicorn |
| Database | SQLite |
| Conversational AI | Configurable OpenAI-compatible chat-completions API |
| Voice assistant | Vapi Web SDK and authenticated backend function tools |
| Image processing | Pillow |
| Department data | JSON catalog and Markdown SOP files |

AI assists with collecting complaint information. Category confirmation, department routing, access control, and final submission are handled by application logic.

## Project structure

```text
samadhan-ai/
├── backend/
│   ├── app/
│   │   ├── main.py          # API setup and frontend serving
│   │   ├── auth.py          # Citizen OTP and staff authentication
│   │   ├── intake.py        # Complaint drafts and text intake
│   │   ├── voice.py         # Vapi sessions and webhook tools
│   │   ├── workflow.py      # Complaints, notices, officers, and analytics
│   │   ├── catalog.py       # Catalog loading and location validation
│   │   ├── catalog.json     # Departments, categories, and locations
│   │   └── db.py            # SQLite schema and database helpers
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── src/                 # React views, API client, and styles
│   ├── package.json
│   └── vite.config.js
├── scripts/
│   └── make_vapi_tools.py   # Generates Vapi function-tool definitions
├── sops/                   # Department procedures and category estimates
└── run.py                  # Backend entry point
```

The database and uploaded images are created under `backend/data/` when the application runs. The frontend build is generated under `frontend/dist/`.

## Getting started

### Prerequisites

- Python 3.11 or newer is recommended.
- Node.js 22 LTS and npm are recommended.
- Git.
- An AI provider account and a Vapi account are optional. Text intake works without them.

### 1. Clone the repository

```bash
git clone https://github.com/divyanshups/samadhan-ai.git
cd samadhan-ai
```

### 2. Prepare the backend

**Windows PowerShell**

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
```

**macOS / Linux**

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

Open `backend/.env` and set `ADMIN_USERNAME` and `ADMIN_PASSWORD` before the first launch. Leave the AI and Vapi settings empty if you want to start with guided text intake.

### 3. Start the backend

Run from the repository root.

**Windows PowerShell**

```powershell
.\.venv\Scripts\python.exe run.py
```

**macOS / Linux**

```bash
.venv/bin/python run.py
```

The backend starts at <http://127.0.0.1:8000>. It creates the database and one initial administrator account automatically.

### 4. Start the frontend

In a second terminal, run from the repository root:

```bash
cd frontend
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. Vite forwards `/api` requests to the backend on port `8000`. Use the URL printed in the terminal if the default frontend port is occupied.

### 5. Sign in

- **Citizen:** Choose the citizen login, enter a valid ten-digit Indian mobile number, use the OTP shown on screen, and complete the name, district, and locality fields.
- **Administrator:** Choose staff login and enter the credentials configured before the first launch.
- **Officer:** An administrator must create the account and assign its district and department first.

The repository's initial defaults are `admin` / `Samadhan@2026!`. Replace the default password before sharing the application. The initial admin settings are used when creating the account; changing them after the account exists does not reset its stored credentials.

## Configuration

Configuration is loaded from `backend/.env`. Restart the backend after changing it.

| Variable | Purpose |
| --- | --- |
| `ADMIN_USERNAME` | Username for the initial administrator account |
| `ADMIN_PASSWORD` | Initial administrator password; must contain 8–128 characters |
| `ALLOWED_ORIGINS` | Comma-separated frontend origins permitted by CORS |
| `LLM_API_KEY` | API key for the conversational model |
| `LLM_BASE_URL` | Provider API base URL; the backend appends `/chat/completions` |
| `LLM_MODEL` | Model identifier supported by the configured provider |
| `LLM_JSON_MODE` | Requests JSON-formatted extraction responses when `true` |
| `VAPI_PUBLIC_KEY` | Vapi public key used by the browser SDK |
| `VAPI_ASSISTANT_ID` | Saved Vapi assistant used for Hindi voice intake |
| `VAPI_WEBHOOK_SECRET` | Secret expected in the webhook's Bearer authorization header |
| `SAMADHAN_DB` | Optional SQLite path override; defaults to `backend/data/samadhan-v2.sqlite3` |

The Vapi public key is intended for browser use; the LLM key and webhook secret belong on the backend.

### Optional conversational AI

Set all three provider values:

```dotenv
LLM_API_KEY=your-provider-api-key
LLM_BASE_URL=https://your-provider.example/v1
LLM_MODEL=your-provider-model-id
LLM_JSON_MODE=true
```

Use the provider's API base URL, without the final `/chat/completions` path. The values above are placeholders. Choose a model that supports structured JSON extraction; set `LLM_JSON_MODE=false` if the provider does not accept the `response_format` parameter.

The assistant collects one field at a time and can capture explicit corrections. If no API key is configured, the application uses guided intake. Provider failures trigger a guided fallback so the citizen can continue.

### Optional Hindi voice assistant

1. Configure a Hindi-capable Vapi assistant and set `VAPI_PUBLIC_KEY` and `VAPI_ASSISTANT_ID` in `backend/.env`.
2. Generate a webhook secret using Python:

   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

   Use your virtual environment's Python executable if `python` is unavailable.

3. Set `VAPI_WEBHOOK_SECRET` to that value. Configure a Vapi Bearer Token credential with the same secret and retain its credential ID.
4. Make the running backend reachable through a public HTTPS URL. The tool endpoint is `POST /api/vapi/tools` and expects `Authorization: Bearer <VAPI_WEBHOOK_SECRET>`.
5. From the repository root, create the output directory and generate the tool definitions:

   ```bash
   mkdir docs
   python scripts/make_vapi_tools.py --base-url https://your-backend.example --credential-id your-vapi-credential-id
   ```

   Skip `mkdir docs` if it already exists. Pass the backend origin without `/api/vapi/tools`. Generated definitions are written to `docs/vapi-tools/`.

6. Configure the four generated function tools on the assistant:

   | Tool | Purpose |
   | --- | --- |
   | `get_complaint_context` | Load saved fields and available category IDs |
   | `update_complaint_draft` | Save new information or explicit corrections |
   | `show_categories` | Request the website category selector |
   | `ready_for_preview` | Make preview available once required fields are complete |

7. In the assistant instructions, require short Hindi replies and one question at a time. Collect the issue, house or landmark, area, ward, duration, confirmed category, and optional remarks in that order. Call the context tool first, save answers through the update tool, and use only category IDs returned by the backend. Explain that the citizen adds the pincode and optional photo in preview; the voice assistant must not submit the complaint.
8. Restart the backend, sign in as a citizen, switch to Hindi, and start voice intake from the website. Allow microphone access.

Calls must start from the website because it supplies the temporary draft session needed by the webhook. Starting a call directly in the Vapi dashboard does not supply that session. Opening the tool URL in a browser sends a GET request and may show `Method Not Allowed`; this endpoint accepts POST requests.

## Complaint workflow

1. The citizen completes their profile and prepares a complaint draft.
2. The citizen selects a category, reviews the form, adds a pincode and optional image, and confirms submission.
3. The complaint starts as `SUBMITTED`. Its category determines the department, except for categories requiring manual allocation.
4. An officer in the relevant district and department advances it through `ASSIGNED`, `IN_PROGRESS`, and `COMPLETED`, with a responsible employee and remarks.
5. After completion, the citizen can confirm resolution or report that the issue remains unresolved. Confirmation changes the status to `RESOLVED`; unresolved feedback returns it to `IN_PROGRESS`.
6. If no feedback arrives within seven days of completion, the background review job marks the complaint `RESOLVED` automatically.

The background job runs while the backend is running. It also checks for overdue complaints and creates in-app notifications. Department allocation by the administrator does not itself change the complaint to `ASSIGNED`.

## Run the built frontend

To serve the compiled frontend from the backend:

```bash
cd frontend
npm ci
npm run build
cd ..
```

Start or restart the backend with the command for your operating system, then open <http://127.0.0.1:8000>. The backend serves `frontend/dist/` when the build exists at startup. No separate frontend dev server is needed for this mode.

## API documentation

With the backend running:

- Interactive API documentation: <http://127.0.0.1:8000/docs>
- API health and configuration flags: <http://127.0.0.1:8000/api/health>
- Department, category, and location catalog: <http://127.0.0.1:8000/api/catalog>

Authenticated endpoints use `Authorization: Bearer <session-token>`. The Vapi webhook uses its separate webhook secret.

## Troubleshooting

| Issue | Check |
| --- | --- |
| Frontend cannot connect | Keep the backend running on port `8000` and start Vite from `frontend/` |
| Backend root shows a build message | Use the frontend dev URL, or run `npm run build` and restart the backend |
| Conversational AI is unavailable | Set the API key, base URL, and model; check backend logs for provider errors |
| Hindi voice button is unavailable | Set all three Vapi variables and restart the backend |
| Voice connects but fields do not save | Verify the tools, public HTTPS endpoint, Bearer credential, and website-created draft session |
| Vapi webhook returns `401` | Ensure its Bearer token matches `VAPI_WEBHOOK_SECRET` |
| Vapi webhook returns `405` | Send POST requests rather than opening the URL in a browser |
| Image upload fails | Use a valid JPEG, PNG, or WebP image smaller than 5 MB and no larger than 20 megapixels |
| Admin credentials do not change after editing `.env` | Existing administrator credentials are preserved on restart |

## Prototype scope

- Districts and localities are selected from the bundled catalog, which currently contains five districts.
- SOP procedures and estimated timelines are prototype examples, not official government service commitments. See [the SOP index](sops/README.md).
- Updates and messages are delivered in the application; SMS delivery is not implemented.
- SQLite and uploaded images are stored locally. Back up `backend/data/` to preserve them.
- Public deployment requires replacing the on-screen OTP with real verification and configuring HTTPS, secure credentials, persistent storage, and the intended frontend origins. `run.py` binds to the local machine by default.

## Contributing

Open an issue to report a bug or discuss a change. For a pull request, describe the problem, the change, and how you verified it. Keep catalog entries and their linked SOP files consistent, and exclude credentials, runtime data, and generated build files.

## License

This repository is under MIT LICENSE.
