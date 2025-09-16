"use client"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { MessageSquare, Mail, Zap, Home as HomeIcon, LogOut } from "lucide-react"
import React from "react"
import { useSession, signOut } from "next-auth/react"
import AuthButtons from "./AuthButtons"

interface SidebarProps {
  currentView: string
  setCurrentView: (view: string) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

const NavButton = ({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean
  onClick: () => void
  children: React.ReactNode
}) => {
  const baseClasses = "justify-start w-full text-lg py-3 px-4 rounded-2xl transition-all duration-300 border-2"
  const activeClasses = "bg-orange-500 text-white border-black font-bold shadow-[2px_2px_0px_#000] hover:bg-orange-600"
  const inactiveClasses = "bg-transparent text-black border-transparent hover:bg-orange-100 hover:border-black"

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
      style={{ fontFamily: "'Baloo 2', cursive" }}
    >
      <div className="flex items-center">{children}</div>
    </button>
  )
}

export default function Sidebar({
  currentView,
  setCurrentView,
  sidebarOpen,
  setSidebarOpen,
}: SidebarProps) {
  const { data: session } = useSession()

  const handleNavigation = (view: string) => {
    setCurrentView(view)
    setSidebarOpen(false) // Always close sidebar on navigation
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-70 flex-col border-r-2 border-black bg-white p-6 md:flex ${
        sidebarOpen ? "flex" : "hidden"
      }`}
    >
      <h2
        className="text-4xl font-bold text-black"
        style={{ fontFamily: "'Luckiest Guy', cursive", letterSpacing: "-1px" }}
      >
        Campus Companion
      </h2>

      <div className="my-4 h-[2px] w-full rounded-full bg-black"></div>

      <nav className="flex flex-col space-y-2 mt-4">
        <NavButton isActive={currentView === "home"} onClick={() => handleNavigation("home")}>
          <HomeIcon className="mr-3 h-5 w-5" />
          Home
        </NavButton>
        <NavButton isActive={currentView === "chat"} onClick={() => handleNavigation("chat")}>
          <MessageSquare className="mr-3 h-5 w-5" />
          Agent Chat
        </NavButton>
        <NavButton isActive={currentView === "updates"} onClick={() => handleNavigation("updates")}>
          <Mail className="mr-3 h-5 w-5" />
          Important Updates
        </NavButton>
        <NavButton isActive={currentView === "advisor"} onClick={() => handleNavigation("advisor")}>
          <Zap className="mr-3 h-5 w-5" />
          Advisor Agent
        </NavButton>
      </nav>

      <div className="mt-auto pt-4 border-t-2 border-black">
        {session ? (
          <div className="flex items-center justify-between">
            <span
              className="truncate text-base font-bold text-gray-800"
              style={{ fontFamily: "'Baloo 2', cursive" }}
            >
              {session.user?.name || session.user?.email}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut()}
              className="hover:text-orange-500 hover:bg-orange-100 rounded-full"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          <AuthButtons />
        )}
      </div>
    </aside>
  )
}
