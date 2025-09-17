"use client"
import React from "react"
import Image from "next/image"
import { CalendarClock, FileText, Zap, BookOpen, Layers, Target } from "lucide-react"

// Import doodle-style fonts in your _document.js or Layout file:



interface LandingPageProps {
  setCurrentView: React.Dispatch<React.SetStateAction<string>>
}


const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="p-5 bg-white rounded-2xl border-3 border-black shadow-md hover:border-orange-500 transition-all duration-300 group max-w-sm mx-auto">
    <div className="flex items-center justify-center w-14 h-14 bg-orange-100 rounded-lg mb-4 border-2 border-black">
      <div className="text-orange-500">{icon}</div>
    </div>
    <h3 
      className="text-xl font-bold text-black mb-2" 
      style={{ fontFamily: "'Baloo 2', 'Luckiest Guy', cursive" }}
    >
      {title}
    </h3>
    <p className="text-gray-700 text-sm leading-relaxed">{description}</p>
  </div>
);

const HowItWorksStep = ({ stepNumber, title, description, icon }: { stepNumber: number, title: string, description: string, icon: React.ReactNode }) => (
  <div className="flex flex-col items-center text-center">
    <div className="flex items-center justify-center w-24 h-24 bg-orange-500 text-white rounded-full mb-6 border-4 border-black shadow-md">
      {icon}
    </div>
    <h3 className="text-2xl font-bold text-black mb-4" style={{ fontFamily: "'Baloo 2', 'Luckiest Guy', cursive" }}>
      {stepNumber}. {title}
    </h3>
    <p className="text-gray-800 max-w-sm leading-relaxed">{description}</p>
  </div>
);

export default function LandingPage({ setCurrentView }: LandingPageProps) {
  return (
    <div className="min-h-screen w-full flex flex-col bg-white text-black font-sans relative overflow-x-hidden">
      {/* Section 1: Hero */}
      {/* CHANGED: Significantly moved content up (pt-20) and right (lg:px-24) */}
      <section className="flex items-center justify-center flex-grow pt-20 pb-16 px-6 lg:px-24 relative overflow-visible">
        {/* CHANGED: Moved image up (top-0) and resized it to create more space */}
        <div className="absolute top-0 right-15 w-full h-full lg:w-[50%] lg:h-[600px] pointer-events-none z-0">
          <Image
            src="/landing3.png"
            alt="Doodle-style illustrations for Campus Companion"
            layout="fill"
            objectFit="contain"
            objectPosition="center"
            className="opacity-95"
            priority
          />
        </div>

        <div className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-2 items-center gap-16 z-10 relative">
          {/* Left Side: Text Content */}
          <div className="space-y-8 text-center lg:text-left relative">
            <h1
              className="text-6xl md:text-7xl font-bold mb-2"
              style={{ fontFamily: "'Luckiest Guy', 'Baloo 2', cursive", color: "#231f20", letterSpacing: "-2px" }}
            >
              Campus<br />
              <span className="text-orange-500" style={{ fontFamily: "'Baloo 2', cursive", fontSize: "1em" }}>
                Companion
              </span>
            </h1>
            <p
              className="text-xl font-bold italic text-gray-800 mb-2"
              style={{ fontFamily: "'Baloo 2', cursive" }}>
              Never miss a moment that matters.
            </p>
            <p className="text-lg text-gray-800 leading-relaxed max-w-xl mx-auto lg:mx-0" style={{ fontFamily: "'Baloo 2', cursive" }}>
              Stay ahead of your deadlines, events, and goals with your smart doodle-inspired planner.
              Campus Companion brings together schedules, updates, and insights—so student life feels
              fun, clear, and under control.
            </p>
            <button
              onClick={() => setCurrentView('chat')}
              className="px-10 py-4 bg-orange-500 text-white font-bold rounded-full shadow-lg border-4 border-black text-xl hover:bg-orange-600 transition-all duration-300 uppercase tracking-wide"
              style={{ fontFamily: "'Luckiest Guy', 'Baloo 2', cursive", boxShadow: "2px 4px 0 #ffbd39" }}
            >
              Explore More
            </button>
          </div>
          {/* CHANGED: Adjusted spacer height to match the new layout */}
          <div className="hidden lg:block relative h-[550px]"></div>
        </div>
      </section>

      {/* Section 2: Features */}
      <section className="py-24 px-6 bg-orange-50 border-t-4 border-orange-100">
        <div className="max-w-7xl mx-auto text-center">
          <div className="space-y-3 mb-16">
            <h2 className="text-5xl font-bold text-black" style={{ fontFamily: "'Luckiest Guy', 'Baloo 2', cursive" }}>
              An Agent That Does It All
            </h2>
            <p className="text-xl text-gray-900 max-w-3xl mx-auto leading-relaxed" style={{ fontFamily: "'Baloo 2', cursive" }}>
              From proactive scheduling to strategic planning, your doodle-style buddy ensures you’re
              always organized and stress-free.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <FeatureCard
              icon={<CalendarClock className="w-10 h-10" />}
              title="Automated Scheduling"
              description="Automatically scans websites, emails, and PDFs for events and adds them to your calendar, so you never miss a deadline or meeting."
            />
            <FeatureCard
              icon={<FileText className="w-10 h-10" />}
              title="Document Q&A"
              description="Upload a syllabus or a research paper and ask direct questions. Get summaries and key insights instantly."
            />
            <FeatureCard
              icon={<Zap className="w-10 h-10" />}
              title="Strategic Advisor"
              description="Get personalized, step-by-step roadmaps for complex goals like preparing for a hackathon or learning a new skill."
            />
          </div>
        </div>
      </section>

      {/* Section 3: How It Works */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <div className="space-y-3 mb-16">
            <h2 className="text-5xl font-bold text-black" style={{ fontFamily: "'Luckiest Guy', 'Baloo 2', cursive" }}>
              How It Works
            </h2>
            <p className="text-xl text-gray-800 max-w-3xl mx-auto leading-relaxed" style={{ fontFamily: "'Baloo 2', cursive" }}>
              Just three easy steps to turn your messy schedule into a doodle-perfect plan.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16">
            <HowItWorksStep
              stepNumber={1}
              title="Connect Accounts"
              description="Securely link your university email and calendar for seamless integration."
              icon={<Layers className="w-12 h-12" />}
            />
            <HowItWorksStep
              stepNumber={2}
              title="Ask Anything"
              description="Chat naturally to get answers, summarize documents, or generate a personalized action plan."
              icon={<BookOpen className="w-12 h-12" />}
            />
            <HowItWorksStep
              stepNumber={3}
              title="Stay Ahead"
              description="Receive important updates, manage your schedule, and achieve your academic goals with ease."
              icon={<Target className="w-12 h-12" />}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full bg-gray-900 text-gray-100 py-12 px-6 border-t-4 border-black">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-300" style={{ fontFamily: "'Baloo 2', cursive" }}>
            &copy; {new Date().getFullYear()} Campus Companion. All rights reserved.
          </p>
          <div className="flex justify-center space-x-8 mt-4">
            <a href="#" className="hover:text-orange-400 underline transition-colors" style={{ fontFamily: "'Baloo 2', cursive" }}>Privacy</a>
            <a href="#" className="hover:text-orange-400 underline transition-colors" style={{ fontFamily: "'Baloo 2', cursive" }}>Terms</a>
            <a href="#" className="hover:text-orange-400 underline transition-colors" style={{ fontFamily: "'Baloo 2', cursive" }}>Support</a>
          </div>
        </div>
      </footer>
    </div>
  )
}