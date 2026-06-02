<div align="center">
  <h1>🎓 Campus Companion</h1>
  <p><strong>Your Proactive, Multi-Agent AI Workspace for Campus Life</strong></p>
  <p>
    Eliminating student digital overload by unifying Gmail, PDFs, university websites, and personal goals into one intelligent interface—complete with automated scheduling, smart email triage, and live agent reasoning.
  </p>
  <p>
    <a href="https://campus-companion-six.vercel.app"><img src="https://img.shields.io/badge/Live%20Demo-Campus%20Companion-orange?style=for-the-badge&logo=vercel" alt="Live Demo"/></a>
    <a href="https://huggingface.co/aviralsaxena16/campus_mail_classifier_distilbert"><img src="https://img.shields.io/badge/%F0%9F%A4%97%20Hugging%20Face-Mail%20Classifier-FFD21E?style=for-the-badge" alt="Hugging Face Model"/></a>
    <img src="https://img.shields.io/badge/Docker-Enabled-2496ED?style=for-the-badge&logo=docker" alt="Docker"/>
    <img src="https://img.shields.io/badge/CI-Passing-brightgreen?style=for-the-badge&logo=github-actions" alt="CI Passing"/>
    <img src="https://img.shields.io/badge/Coverage-82%25-brightgreen?style=for-the-badge" alt="Coverage 82%"/>
  </p>
</div>

<p align="center">
  <img src="https://github.com/user-attachments/assets/bd0e2d7e-16d6-46b9-b15d-bbed8fbcf070" width="80%">
</p>


## 📸 Screenshots

<table>
  <tr>
    <td align="center"><strong> Scheduling Events (Can be done from your Inbox, PDFs or from some website) </strong></td>
    <td align="center"><strong> Agent Chat + Live Reasoning </strong></td>
  </tr>
  <tr>
    <td><img width="1007" height="483" alt="image" src="https://github.com/user-attachments/assets/d897119e-7d43-4a7b-a8ff-280e21b71c7d" />
</td>
    <td><img src="https://github.com/user-attachments/assets/917cfde4-8c6a-4e0a-9c25-ed7ae9112f22" width="100%" alt="Agent Chat"/></td>
  </tr>
  <tr>
    <td align="center"><strong> Mail Triage Assistant - Classify your Inbox into (Career, Event, Deadline, Normal, Spam)</strong></td>
    <td align="center"><strong> Advisor Agent / Roadmap Generator (Can be Customized and Shared/Downlaoded as PDF) </strong></td>
  </tr>
  <tr>
    <td><img src="https://github.com/user-attachments/assets/2ebc9a22-b1dd-441c-8421-3754a47c42a6" width="100%" alt="Mail Triage"/></td>
    <td><img width="1883" height="919" alt="Screenshot 2025-11-03 224918" src="https://github.com/user-attachments/assets/c70472f7-5642-4f9d-b6e8-bb8ef9f86d92" />
</td>
  </tr>
</table>


---

## ❗ The Problem

Students juggle a fragmented digital landscape department portals, Gmail, PDFs, contest pages, and Slack channels all demanding constant attention. The result is a chronic **Fear Of Missing Out (FOMO)**: missed scholarship deadlines, overlooked internship postings, and skipped events. This cognitive overhead degrades both academic performance and mental health.

---

## 💡 The Solution

Campus Companion is a **proactive AI partner** not just a chatbot. It autonomously monitors information sources on a schedule, classifies what matters, and surfaces it at the right time. The agent reasons transparently, showing its tool calls, retrieval steps, and execution plan in real time so students always know *why* something was flagged.

---

## ✨ Feature Overview

| Feature | Description |
|---|---|
| 🧠 **Unified Multi-Source Chat** | Query PDFs (pgvector RAG), live websites (Playwright), and Gmail in one conversation. The agent can also create Google Calendar events mid-chat. |
| 🤖 **Agent Thinking UI** | A live sidebar surfaces every tool call, retrieval result, and reasoning step as it happens — full transparency, zero black box. |
| 📬 **DistilBERT Email Triage** | Fine-tuned on 2,500+ labelled university emails. Classifies incoming mail as **Career**, **Event**, **Deadline**, **Normal**, or **Spam** with thumbs-up/thumbs-down RLHF feedback loop. |
| ⏱️ **24-Hour Scheduled Scanner** | Background agent scans for newly important emails every 24 hours, with a manual **Scan Now** override button. |
| 🗺️ **Roadmap Generator** | Input any goal (e.g., *"Prepare for Google Summer of Code"*) and get a structured, editable, downloadable roadmap ranked by community popularity. |
| 🕸️ **Multi-Source RAG** | Retrieval-Augmented Generation across PDFs, scraped websites, and Gmail ensures grounded, accurate responses. |
| 📆 **Automated Calendar** | Parses dates and deadlines from any source (email, PDF, website) and auto-creates Google Calendar events. |
| 🧩 **Contest Discovery** | Fetches upcoming competitive programming contests from **Codeforces**, **LeetCode**, and **CLIST** via a single natural-language prompt. |

---

## 🏗️ System Architecture

Campus Companion is built around three independent async pipelines that share a common authentication and database layer.

```
┌──────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                          │
│   Agent Chat │ Mail Triage │ Advisor Agent │ Google OAuth        │
└────────────┬──────────────────────────────────────┬─────────────┘
             │  REST / SSE                           │ REST
             ▼                                       ▼
┌────────────────────────┐            ┌──────────────────────────┐
│   FastAPI Backend       │            │  Background Scheduler    │
│   /agent  /mail  /roads │            │  (APScheduler 24hr loop) │
└────┬──────┬─────┬───── ┘            └───────────┬──────────────┘
     │      │     │                               │
     ▼      ▼     ▼                               ▼
  ┌──────┐ ┌────────────┐ ┌─────────┐   ┌─────────────────────┐
  │Gemini│ │DistilBERT  │ │LangChain│   │ Gmail API Fetch      │
  │ LLM  │ │ HF Inference│ │ Agent   │   │ + DistilBERT Classify│
  └──────┘ └────────────┘ └────┬────┘   └─────────────────────┘
                                │
          ┌─────────────────────┼──────────────────────┐
          ▼                     ▼                       ▼
   ┌────────────┐      ┌──────────────────┐   ┌──────────────────┐
   │ Supabase   │      │  Playwright       │   │  Google Calendar │
   │ pgvector   │      │  Web Scraper      │   │  API             │
   │ (PDF embed)│      │  (Live websites)  │   │  (Event create)  │
   └────────────┘      └──────────────────┘   └──────────────────┘
```

### Pipeline 1 — Multi-Source RAG Chat

1. **PDF Ingestion** — documents uploaded by the user are chunked, embedded via Google's embedding model, and stored in Supabase `pgvector`.
2. **Website Extraction** — Playwright scrapes live URLs and caches extracted text.
3. **Gmail Fetch** — OAuth-scoped Gmail API pulls and summarises threads on demand.
4. **Agent Loop** — A LangChain multi-tool agent decides which retrieval source(s) to hit, synthesises the results, and optionally fires a Google Calendar create call.

### Pipeline 2 — Proactive Email Updates

1. **APScheduler** runs a background task every 24 hours (also triggerable manually).
2. New emails are fetched via Gmail API and passed through the **fine-tuned DistilBERT** classifier (hosted on Hugging Face Inference API).
3. Emails classified as Career, Event, or Deadline surface in the Mail Triage UI.
4. Users provide thumbs-up / thumbs-down feedback — this data is persisted for future fine-tuning rounds.

### Pipeline 3 — Calendar Automation

1. Any agent response containing a date/event triggers a calendar tool call.
2. The FastAPI backend exchanges the OAuth token and calls Google Calendar API to create the event.
3. Users see a confirmation directly in the Agent Chat response.

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | Next.js 14, TailwindCSS | SSR, fast routing, responsive UI |
| **Backend** | FastAPI (Python 3.11) | Async-first, auto-OpenAPI docs, Pydantic validation |
| **Agent Framework** | LangChain | Multi-tool orchestration, chain-of-thought |
| **LLM** | Google Gemini | High context window, multimodal support |
| **ML Model** | DistilBERT (fine-tuned, HF Inference) | Lightweight, fast email classification |
| **Vector DB** | Supabase + pgvector | Managed Postgres + semantic search in one |
| **Web Scraping** | Playwright | JavaScript-rendered site support |
| **Scheduling** | APScheduler | In-process 24-hour background tasks |
| **Auth** | Google OAuth 2.0 | Secure Gmail + Calendar access |
| **External APIs** | Gmail, Google Calendar, Codeforces, CList, LeetCode | Real-time data |
| **CI/CD** | GitHub Actions → Render (backend), Vercel (frontend) | Automated lint, test, coverage, deploy |

---

## 📁 Project Structure

```
Campus-Companion/
├── .github/
│   └── workflows/
│       └── backend-ci.yml          # Lint + test + coverage + deploy
├── backend/
│   ├── agents/                     # LangChain agent definitions & tools
│   ├── routes/                     # FastAPI routers (agent, mail, roadmap, auth)
│   ├── models/                     # Pydantic schemas
│   ├── services/                   # Gmail, Calendar, Supabase, DistilBERT clients
│   ├── scheduler/                  # APScheduler 24-hr email scan
│   ├── tests/                      # pytest suite (82% coverage)
│   ├── requirements.txt
│   ├── run.py                      # Entrypoint
│   └── .env.example
├── frontend/
│   ├── app/                        # Next.js App Router pages
│   │   ├── chat/                   # Agent Chat + Agent Plan sidebar
│   │   ├── mail/                   # Mail Triage UI
│   │   └── advisor/                # Roadmap Generator
│   ├── components/                 # Reusable UI components
│   ├── lib/                        # API clients
│   └── .env.local.example
└── deliverables/                   # Project report / slides
```

---

## ⚙️ CI / CD Pipeline

Every push to `main` or `develop` triggers the GitHub Actions workflow:

```
Push / PR
   │
   ├─► Lint (flake8)
   │
   ├─► Unit + Integration Tests (pytest + httpx + asyncio)
   │       └─ Real Postgres 15 service container spun up
   │
   ├─► Coverage Report (target ≥ 82%)
   │
   └─► Auto-deploy to Render (backend) on main merge
         Frontend auto-deploys to Vercel on push
```

Test environment uses isolated dummy credentials so no real API keys are required in CI.

---

## 🚀 Local Development

### Prerequisites

- Python 3.11
- Node.js 18+
- A Google Cloud Project with OAuth 2.0 credentials (Gmail API + Google Calendar API enabled)
- A Supabase project (PostgreSQL + pgvector extension)
- Groq or Google API key for LLM calls
- Hugging Face API key for DistilBERT inference

### 1. Clone the repo

```bash
git clone https://github.com/aviralsaxena16/Campus-Companion.git
cd Campus-Companion
```

### 2. Backend setup

```bash
cd backend
py -3.11 -m venv venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
playwright install

cp .env.example .env
# Fill in your keys (see Environment Variables below)

python run.py
```

Backend runs at `http://localhost:8000`. Interactive API docs at `http://localhost:8000/docs`.

### 3. Frontend setup

```bash
cd frontend
npm install

cp .env.local.example .env.local
# Fill in your Next.js environment variables

npm run dev
```

Frontend runs at `http://localhost:3000`.

### Environment Variables

| Variable | Where | Description |
|---|---|---|
| `GOOGLE_API_KEY` | backend | Gemini LLM |
| `GROQ_API_KEY` | backend | Groq LLM (fallback) |
| `HF_API_KEY` | backend | Hugging Face DistilBERT inference |
| `SUPABASE_URL` | backend | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | backend | Supabase service role key |
| `DATABASE_URL` | backend | PostgreSQL connection string |
| `GOOGLE_AUDIENCE_CLIENT_ID` | backend | Google OAuth client ID |
| `CLIST_API_KEY` | backend | CList API for contest discovery |
| `NEXT_PUBLIC_API_URL` | frontend | Backend base URL |

---

## 🧪 Running Tests

```bash
cd backend

# Run full test suite
pytest tests -v

# With coverage report
coverage run -m pytest
coverage report

# Lint check
flake8 .
```

Current coverage: **82%** across agent tools, API routes, classifier integration, and scheduler logic.

---

## 🤖 ML Model — Fine-tuned DistilBERT

The email classifier is trained from `distilbert-base-uncased` on a custom dataset of **2,500+ university emails** labelled across five classes:

| Label | Examples |
|---|---|
| `CAREER` | Internship postings, placement drives, resume workshops |
| `EVENT` | Guest talks, hackathons, cultural fests |
| `DEADLINE` | Scholarship applications, fee payments, form submissions |
| `NORMAL` | Class rescheduling, general announcements |
| `SPAM` | Promotional emails, irrelevant newsletters |

The model is served via Hugging Face Inference API. User feedback (👍/👎) is logged to Supabase for future fine-tuning iterations, creating a continuous improvement loop.

---

## 🔮 Roadmap

- [ ] WhatsApp / Telegram notification channel
- [ ] Multi-university support (configurable department URLs)
- [ ] Peer-to-peer roadmap sharing and upvoting
- [ ] In-app PDF upload from mobile
- [ ] Offline-capable PWA
- [ ] LangGraph migration for stateful multi-agent orchestration
- [ ] Active Learning pipeline to retrain DistilBERT from accumulated user feedback

---

## 🙏 Acknowledgements

- [LangChain](https://langchain.com) — agent orchestration framework
- [Supabase](https://supabase.com) — managed Postgres + pgvector
- [Hugging Face](https://huggingface.co) — model hosting and DistilBERT base weights
- [Playwright](https://playwright.dev) — headless browser automation
- [CList.by](https://clist.by) — competitive programming contest aggregator

---

<div align="center">
  Built with ❤️ by <a href="https://github.com/aviralsaxena16">Aviral Saxena</a> and contributors
  <br/>
  <a href="https://campus-companion-six.vercel.app">Live Demo</a> · <a href="https://github.com/aviralsaxena16/Campus-Companion/issues">Report a Bug</a> · <a href="https://github.com/aviralsaxena16/Campus-Companion/pulls">Contribute</a>
</div>
