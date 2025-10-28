// In your Sidebar component file

"use client"

import { Button } from "@/components/ui/button"
// --- 1. Import 'LogIn' from lucide-react ---
import { MessageSquare, Mail, Zap, Home as HomeIcon, LogOut, LogIn } from "lucide-react" 
import React from "react"
import { useAuth } from "@/context/AuthContext" 
import { signOut } from "next-auth/react"

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
  const { session, status, requestProtectedAccess } = useAuth()

  const handleNavigation = (view: string) => {
    let accessGranted = true;
    
    if (view !== 'home') {
      accessGranted = requestProtectedAccess();
    }
    
    if (accessGranted) {
      setCurrentView(view)
      setSidebarOpen(false) 
    }
  }

  // --- DEBUGGING: New click handler ---
  const handleSignInClick = () => {
    console.log("Sidebar: Sign In button clicked!"); // <-- ** THIS IS THE DEBUG LINE **
    requestProtectedAccess();
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
          Mail Updates
        </NavButton>
        <NavButton isActive={currentView === "advisor"} onClick={() => handleNavigation("advisor")}>
          <Zap className="mr-3 h-5 w-5" />
          Advisor Agent
        </NavButton>
      </nav>

      <div className="mt-auto pt-4 border-t-2 border-black">
        {status === 'authenticated' && session?.user ? (
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
          // --- 2. THIS IS THE NEW CODE ---
          // Replaced the "Not signed in" text with a clear "Sign In" button.
          <Button
            onClick={handleSignInClick} // <-- ** USING THE NEW HANDLER **
            className="justify-start w-full text-lg py-3 px-4 rounded-2xl transition-all duration-300 border-2 border-black bg-orange-500 text-white font-bold shadow-[2px_2px_0px_#000] hover:bg-orange-600"
            style={{ fontFamily: "'Baloo 2', cursive" }}
          >
            <div className="flex items-center">
              <LogIn className="mr-3 h-5 w-5" />
              Sign In
            </div>
          </Button>
        )}
      </div>
    </aside>
  )
}
