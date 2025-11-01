"use client"
import React, { useState, useEffect } from "react"
import { Loader2, Zap } from "lucide-react"
import RoadmapDisplay from "./RoadmapDisplay"
import { type Roadmap } from "./GenerateRoadmap" // Import the shared type

interface RoadmapFromDB {
  id: string
  goal: string
  roadmap_json: Roadmap
  user_id: string
  upvotes: number
}

interface PopularRoadmapsProps {
  currentUserId: string | undefined;
}

export default function PopularRoadmaps({ currentUserId }: PopularRoadmapsProps) {
  const [popularRoadmaps, setPopularRoadmaps] = useState<RoadmapFromDB[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/roadmaps') // GET request to /api/roadmaps
    .then(res => {
      if (!res.ok) throw new Error('Failed to fetch popular roadmaps');
      return res.json();
    })
    .then(data => {
      setPopularRoadmaps(data);
      setIsLoading(false);
    })
    .catch(err => {
      console.error(err);
      setIsLoading(false);
    });
  }, []);

  return (
    <div className="mt-12">
      <h2 className="text-4xl font-bold mb-6 flex items-center" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
         <Zap className="w-8 h-8 mr-3 text-orange-500" />
         Popular Roadmaps
      </h2>
      
      {isLoading && (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
        </div>
      )}
      
      <div className="space-y-8">
        {popularRoadmaps && popularRoadmaps.map(roadmap => (
          <RoadmapDisplay 
            key={roadmap.id}
            initialRoadmap={{ 
              ...roadmap.roadmap_json, 
              id: roadmap.id, 
              upvotes: roadmap.upvotes, 
              user_id: roadmap.user_id 
            }}
            currentUserId={currentUserId}
          />
        ))}
        {popularRoadmaps && popularRoadmaps.length === 0 && (
           <p className="text-gray-800" style={{ fontFamily: "'Baloo 2', cursive" }}>No popular roadmaps found yet. Be the first to generate one!</p>
        )}
      </div>
    </div>
  )
}