# Campus Companion: Your Proactive AI University Navigator 🚀  

**Clarity in your studies. Calm in your mind.**  

---

## 📌 Project Information  

- **Name:** Aviral Saxena  
- **University:** Indian Institute of Technology Bhilai (IIT Bhilai)  
- **Department:** Computer Science and Engineering (CSE)  

<p align="center">
 <img width="80%" alt="Screenshot 2025-09-17 095256" src="https://github.com/user-attachments/assets/85b26127-2a86-4ba0-9060-eb34f1eb7753" />

</p>  

---

## ❗ The Problem: The Student's "Digital Overload" 😥  

In today's university environment, students are inundated with a relentless stream of information.  

Critical opportunities—career-defining internships, skill-building workshops, and essential academic deadlines—are scattered across a chaotic digital landscape of department websites, emails, and PDFs.  

This manual effort creates a pervasive **"Fear of Missing Out" (FOMO)**, impacting students' focus and mental well-being.  

---

## 💡 The Solution: A Proactive AI Partner  

**Campus Companion** is an intelligent agent built to combat this digital overload.  

It serves as a **proactive digital partner** that automates the entire opportunity-management lifecycle, transforming **chaos into clarity**.  

More than just a productivity tool, Campus Companion is designed to **reduce cognitive load and anxiety**, allowing students to focus on what truly matters.  

---

## ✨ Key Features  

| Feature | Description |
|---------|-------------|
| 🧠 **Multi-Modal Intelligence** | Ingests and understands information from live websites, Gmail, and PDFs, featuring a full Retrieval-Augmented Generation (RAG) system for document Q&A and also can schedule the events in them directly to your calendar. |
| 🔍 **Proactive Discovery** | Automatically scans platforms like LeetCode and Codeforces via public APIs to find and can update it to your calendar the upcoming competitive programming contests with just a prompt. |
| 🤖 **Automated Scheduling** | Intelligently parses event details from any source and adds them directly to the user's Google Calendar on a single prompt. |
| 🖥️ **Plan Monitoring & Editing UI** | A user interface that allows monitoring the agent's step-by-step reasoning in real time, and editing or customizing the agent’s plan. |
| 🗺️ **Strategic Advisor** | Generates personalized, step-by-step roadmaps for goals like hackathon preparation. Users can edit the agent's plan and download the final version as a PDF. |
| 📬 **Scheduled Updates** | Runs a daily background job to scan the user's inbox for important messages, summarizing them in a dedicated **Important Updates** section of the UI. |

<p align="center">
 <img width="70%" alt="Screenshot 2025-09-17 020434" src="https://github.com/user-attachments/assets/917cfde4-8c6a-4e0a-9c25-ed7ae9112f22" />

</p>  


---

### 🎥 Live Demo Video


[**Watch the full demo of Campus Companion on Google Drive**](https://drive.google.com/file/d/15Yd4YmEe62-l7Q4d8gWZu-rR9bkkMxb3/view?usp=sharing)

*(For a full breakdown, please see the **[System Design Document](link-to-your-sdd.pdf)** in this repository.)*
---

## 🛠️ Tech Stack & Architecture  

The application is built on a **modern three-tier architecture** designed for scalability and responsiveness.  

| Category   | Technologies |
|------------|--------------|
| **Frontend** | Next.js, TailwindCSS |
| **Backend**  | FastAPI |
| **AI Core**  | Langchain, RAG Pipeline |
| **Database** | Supabase (PostgreSQL) |
| **Tools**    | Google APIs (Gmail, Calendar), CList API,Codeforces API |

📖 *(For a full breakdown, please see the **System Design Document** in this repository.)*  

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
