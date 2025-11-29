# 📚 Campus Companion – Your Proactive AI University Navigator 🚀

**Clarity in your studies. Calm in your mind.**

Campus Companion is a multi-agent AI platform that helps students escape digital overload by unifying emails, PDFs, websites, competitive programming contests, and personal goals into a single intelligent workspace. It proactively schedules events, classifies important emails, generates roadmaps, and shows full agent reasoning in real time.

<p align="center">
 <img width="80%" alt="Campus Companion Screenshot" src="https://github.com/user-attachments/assets/85b26127-2a86-4ba0-9060-eb34f1eb7753" />
</p>

---

## ❗ Problem: The Student Digital Overload

Students must constantly monitor scattered information sources—department websites, Gmail, PDFs, competitions, and announcements.  
This leads to a constant **Fear of Missing Out (FOMO)**, missed opportunities, and unnecessary cognitive load.

---

## 💡 Solution: A Proactive AI Partner

Campus Companion serves as an AI-powered personal university assistant.  
It reads your PDFs, scans websites, understands your Gmail inbox, classifies important emails, schedules events, and generates roadmaps—all through a unified intelligence layer.

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🧠 **Unified Multi-Source AI Chat** | Query PDFs (embedded via pg_vector), live websites, and Gmail in one place. The agent can also schedule events directly to Google Calendar. |
| 🤖 **Agent Thinking UI** | View the agent’s full reasoning: tool calls, retrievals, plans, and execution. |
| 📬 **Email Classifier (DistilBERT)** | Fine-tuned model that classifies emails as Career, Event, Deadline, Normal, or Spam. |
| ⏱️ **24-Hour Scheduled Agent** | Automatically scans for new important emails daily; includes a manual **Scan Now** button. |
| 🗺️ **Roadmap Generator** | Creates personalized, editable skill roadmaps for any goal, with PDF download and popularity ranking. |
| 🕸️ **Website + PDF + Email RAG** | Multi-source Retrieval-Augmented Generation ensures accurate and contextual responses. |
| 📆 **Automated Calendar Scheduling** | Parses events and deadlines from any source and adds them to Google Calendar. |
| 🧩 **Contest Discovery** | Fetches upcoming contests from Codeforces, LeetCode, and CLIST with a single prompt. |

<p align="center">
 <img width="70%" alt="Campus Companion UI" src="https://github.com/user-attachments/assets/917cfde4-8c6a-4e0a-9c25-ed7ae9112f22" />
</p>

---

## 🎥 Demo Video

📺 **[Watch the Demo on Google Drive](https://drive.google.com/file/d/15Yd4YmEe62-l7Q4d8gWZu-rR9bkkMxb3/view?usp=sharing)**

---

## 🛠 Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Frontend** | Next.js, TailwindCSS |
| **Backend** | FastAPI |
| **AI / Agents** | LangChain, Multi-tool Agents, RAG |
| **Embeddings** | Supabase (pg_vector) |
| **ML Model** | Fine-tuned DistilBERT (2500+ samples) |
| **Integrations** | Gmail API, Google Calendar API, CList API, Codeforces API |

---

## 🧱 Architecture Overview

Campus Companion contains three major pipelines:

### 1. Multi-Source RAG Pipeline
- PDF ingestion + pg_vector embeddings  
- Website extraction using Playwright  
- Gmail fetch + summarization  

### 2. Important Email Updates Pipeline
- 24-hour scheduled background agent  
- Manual “Scan Now” trigger  
- DistilBERT-based classification  

### 3. Calendar Automation Pipeline
- Extracts dates/events from any source  
- Auto-creates Google Calendar events  

---

## 🚀 How to Run This Project  

### 🔧 Prerequisites   
- Python 3.11  
- A Google Cloud Project with OAuth credentials and the Gmail & Calendar APIs enabled  
- A Supabase project for the PostgreSQL database  

---
---

## How to Run This Project

### Prerequisites
- Node.js and npm  
- Python 3.11  
- A Google Cloud Project with OAuth credentials and the Gmail & Calendar APIs enabled.  
- A Supabase project for the PostgreSQL database.  

### Setup Instructions
Clone the repository:

```bash
git clone https://github.com/aviralsaxena16/Campus-Companion.git
cd Campus-Companion
```

#### Backend Setup:

```bash
cd backend
py -3.11 -m venv venv
.venv\Scripts\activate
pip install -r requirements.txt
playwright install
# Add your credentials to a new .env file (see .env.example)
python run.py
```

#### Frontend Setup:

```bash
cd frontend
npm install
# Add your credentials to a new .env.local file (see .env.local.example)
npm run dev
```

The application will be available at:  
👉 **http://localhost:3000**
