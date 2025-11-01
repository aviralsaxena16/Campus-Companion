"use client"
import React, { useState } from "react"
import { useAuth } from "../../context/AuthContext" 
import { Button } from "../../components/ui/button"
import GenerateRoadmap from "./GenerateRoadmap" // New Component
import MyRoadmaps from "./MyRoadmaps" // New Component

// Helper component for tabs
const TabButton = ({ isActive, onClick, children }: { isActive: boolean, onClick: () => void, children: React.ReactNode }) => (
  <Button
    onClick={onClick}
    variant="ghost"
    className={`pb-2 text-lg font-bold rounded-none border-b-4
      ${isActive 
        ? 'text-orange-500 border-orange-500' 
        : 'text-gray-400 border-transparent hover:text-gray-600'
      }
    `}
  >
    {children}
  </Button>
)

export default function AdvisorView() {
  const [view, setView] = useState<'generate' | 'my_roadmaps'>('generate');
  const { session, isFullyAuthenticated, requestProtectedAccess } = useAuth()

  return (
    <div className="flex flex-col h-full bg-white text-black">
      <header className="flex items-center ml-8 border-b-2 border-black bg-white p-4 justify-between flex-wrap">
        <h1 className="text-3xl font-bold ml-8" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
          Advisor Agent
        </h1>
      </header>

      {/* Tab Navigation */}
      <div className="ml-8 px-4 md:px-8 border-b-2 border-gray-200">
        <div className="flex gap-4">
          <TabButton isActive={view === 'generate'} onClick={() => setView('generate')}>
            Generate New
          </TabButton>
          <TabButton isActive={view === 'my_roadmaps'} onClick={() => setView('my_roadmaps')}>
            My Roadmaps
          </TabButton>
        </div>
      </div>
      
      {/* Conditional View Rendering */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="w-full max-w-4xl mx-auto">
          {view === 'generate' && (
            <GenerateRoadmap 
              session={session} 
              isFullyAuthenticated={isFullyAuthenticated} 
              requestProtectedAccess={requestProtectedAccess}
            />
          )}
          {view === 'my_roadmaps' && (
            <MyRoadmaps 
              session={session} 
              isFullyAuthenticated={isFullyAuthenticated}
            />
          )}
        </div>
      </div>
    </div>
  )
}