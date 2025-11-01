"use client"
import React, { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import RoadmapDisplay from "./RoadmapDisplay"
import { type Roadmap } from "./GenerateRoadmap" // Import the shared type

// Type for the full roadmap object from the DB
interface RoadmapFromDB {
  id: string
  goal: string
  roadmap_json: Roadmap // The nested JSON object
  user_id: string
  upvotes: number
}

interface MyRoadmapsProps {
  session: any; // Type this properly
  isFullyAuthenticated: boolean;
}

export default function MyRoadmaps({ session, isFullyAuthenticated }: MyRoadmapsProps) {
  const [myRoadmaps, setMyRoadmaps] = useState<RoadmapFromDB[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isFullyAuthenticated && session?.user?.email) {
      setIsLoading(true);
      fetch('/api/roadmaps/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: session.user.email })
      })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch roadmaps');
        return res.json();
      })
      .then(data => {
        setMyRoadmaps(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError((err as Error).message);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, [session, isFullyAuthenticated]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
      </div>
    )
  }

  if (error) {
    return <p className="text-red-500">Error: {error}</p>
  }
  
  if (!isFullyAuthenticated) {
     return <p className="text-gray-800" style={{ fontFamily: "'Baloo 2', cursive" }}>Please sign in to see your saved roadmaps.</p>
  }
  
  if (myRoadmaps && myRoadmaps.length === 0) {
     return <p className="text-gray-800" style={{ fontFamily: "'Baloo 2', cursive" }}>You haven&apos;t generated any roadmaps yet. Go to the "Generate New" tab to create one!</p>
  }

  return (
    <div className="space-y-8">
      {myRoadmaps && myRoadmaps.map(roadmap => (
        <RoadmapDisplay 
          key={roadmap.id}
          // Pass the nested roadmap_json as the initialRoadmap, but add the DB-level fields
          initialRoadmap={{ 
            ...roadmap.roadmap_json, 
            id: roadmap.id, 
            upvotes: roadmap.upvotes, 
            user_id: roadmap.user_id 
          }}
          currentUserId={session?.user?.email}
        />
      ))}
    </div>
  )
}