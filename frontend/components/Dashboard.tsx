// In frontend/components/Dashboard.tsx
"use client"

import { Button } from "@/components/ui/button"
import { Menu as MenuIcon } from "lucide-react"
import Sidebar from "./Sidebar"
import ChatSection from "./ChatSection"
import AdvisorView from "./AdvisorView"
import UpdatesView from "./UpdatesView"
import React, { useState } from "react"
import LandingPage from "./LandingPage"

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentView, setCurrentView] = useState("home")

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Hamburger button remains the same, but now correctly overlays the main content */}
      <Button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-[60] md:hidden" // z-index ensures it's on top
        variant="outline"
        size="icon"
      >
        <MenuIcon className="w-6 h-6" />
      </Button>

      {/* UPDATED: Main content is pushed over on desktop to account for the sidebar */}
      <main className="flex flex-1 flex-col transition-all duration-300 md:pl-64">
        {currentView === "home" && <LandingPage />}
        {currentView === "chat" && <ChatSection />}
        {currentView === "updates" && <UpdatesView />}
        {currentView === "advisor" && <AdvisorView />}
      </main>
    </div>
  )
}