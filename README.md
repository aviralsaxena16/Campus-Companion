# Campus Companion: Your Proactive AI University Navigator
**Clarity in your studies. Calm in your mind.**

This project is a submission for the Software Engineer internship role at *i am beside you.*

**Name:** Aviral Saxena  
**University:** Indian Institute of Technology Bhilai (IIT Bhilai)  
**Department:** Computer Science and Engineering (CSE)  

---

## The Problem: The Student's "Digital Overload"
In today's hyper-connected university environment, students are inundated with a relentless stream of information. Critical opportunities—career-defining internships, skill-building workshops, hackathons, and essential academic deadlines—are scattered across a chaotic digital landscape of department websites, club emails, and PDF flyers. The manual effort required to track, filter, and organize this information is a significant source of stress and anxiety, creating a pervasive "Fear of Missing Out" (FOMO) that impacts focus and mental well-being.

---

## The Solution: A Proactive AI Partner
Campus Companion is an intelligent agent built to combat this digital overload. It serves as a proactive digital partner that automates the entire opportunity-management lifecycle, transforming chaos into clarity. More than just a productivity tool, Campus Companion is designed to reduce the cognitive load and anxiety of modern student life, allowing students to focus on what truly matters.

<img width="1880" height="920" alt="Screenshot 2025-09-17 021316" src="https://github.com/user-attachments/assets/19f8887d-039e-42f0-8c8a-7bed445bd14e" />
<img width="1327" height="639" alt="image" src="https://github.com/user-attachments/assets/e4df62d7-24bb-45b9-a1cf-0f4af9b8cf15" />


---

## Key Features

### Multi-Modal Intelligence
The agent can ingest and understand information from a variety of sources:
- **Websites:** Scans live websites, including JavaScript-heavy pages, for event information.  
- **Emails:** Securely reads a user's Gmail inbox to find and schedule important events.  
- **PDFs:** Ingests uploaded PDF documents, allowing for detailed Q&A using a Retrieval-Augmented Generation (RAG) system.  

### Proactive Contest Discovery
The agent doesn't just wait for URLs. It can proactively find upcoming competitive programming contests by integrating directly with reliable public APIs for platforms like LeetCode and Codeforces.

### Automated Scheduling & Plan Monitoring
The agent's core function is to reason, plan, and execute:  
- It can parse event details from any source and automatically schedule them on a user's personal Google Calendar.  
- The **Plan Monitoring UI** provides a real-time, step-by-step view of the agent's internal thought process, from tool selection to final execution.  

### Strategic Advisor & Plan Editing
The agent can generate personalized, step-by-step roadmaps for complex goals, like preparing for a hackathon. The user can then:  
- View the visual roadmap in the UI.  
- Edit the agent's plan directly in the interface.  
- Download the final, customized plan as a PDF.  

### Scheduled Important Updates
The agent runs a proactive background job every 24 hours to scan the user's inbox for important, unread emails. It summarizes these findings and displays them in a dedicated **Important Updates** section of the application.

---

## Tech Stack & Architecture
The application is built on a modern, scalable, three-tiered architecture.

- **Frontend:** Next.js with TypeScript and Tailwind CSS. User authentication is handled by NextAuth.js.  
- **Backend:** FastAPI (Python) for its high performance and native asynchronous support.  
- **AI Core:** LangChain is used to orchestrate the agent, its multi-tool chain, and its interaction with the LLM.  
- **LLM:** Google Gemini powers the agent's reasoning, planning, and summarization capabilities.  
- **Database:** PostgreSQL (hosted on Supabase) for storing user data and application state.  
- **Tools & Integrations:** Playwright, Google APIs (Gmail, Calendar), CList.by API, Hugging Face Embeddings.  

*(For a full breakdown, please see the System Design Document in this repository.)*

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
