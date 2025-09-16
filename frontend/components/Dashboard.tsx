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
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex">
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Hamburger button overlays properly on mobile */}
      <Button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-[60] md:hidden"
        variant="outline"
        size="icon"
      >
        <MenuIcon className="w-6 h-6" />
      </Button>

      {/* Main content with left padding matching smaller sidebar width (w-56 = 224px) */}
      <main className="flex flex-1 flex-col transition-all duration-300 md:pl-70">
        {currentView === "home" && (
          <LandingPage currentView={currentView} setCurrentView={setCurrentView} />
        )}
        {currentView === "chat" && <ChatSection />}
        {currentView === "updates" && <UpdatesView />}
        {currentView === "advisor" && <AdvisorView />}
      </main>
    </div>
  )
}
