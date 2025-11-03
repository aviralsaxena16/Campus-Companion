"use client"
import React, { useState, useEffect } from "react"
import { Loader2, Zap, XCircle, ThumbsUp, Map, Target, TrendingUp, Sparkles } from "lucide-react"
import RoadmapDisplay from "./RoadmapDisplay"
import { type Roadmap } from "./GenerateRoadmap"

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
  const [selectedRoadmap, setSelectedRoadmap] = useState<Roadmap | null>(null)

  const fetchRoadmaps = () => {
    setIsLoading(true);
    fetch('/api/roadmaps')
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
  };

  useEffect(() => {
    fetchRoadmaps();
  }, []);

  // Refresh data when going back to list view
  const handleBackToList = () => {
    setSelectedRoadmap(null);
    fetchRoadmaps(); // Re-fetch to get updated upvote counts
  };

  // Full view modal
  if (selectedRoadmap) {
    return (
      <div className="space-y-4">
        <button 
          onClick={handleBackToList}
          className="flex items-center text-gray-500 hover:text-orange-500 font-bold mb-4 transition-colors"
          style={{ fontFamily: "'Baloo 2', cursive" }}
        >
          <XCircle className="w-5 h-5 mr-2" /> Back to Popular Roadmaps
        </button>
        <RoadmapDisplay 
          initialRoadmap={selectedRoadmap}
          currentUserId={currentUserId}
        />
      </div>
    );
  }

  return (
    <div className="mt-12">
      <h2 className="text-4xl font-bold mb-6 flex items-center" style={{ fontFamily: "'Luckiest Guy', cursive" }}>
         <Zap className="w-8 h-8 mr-3 text-orange-500" />
         Popular Roadmaps
      </h2>
      
      {isLoading && (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
        </div>
      )}
      
      {!isLoading && popularRoadmaps && popularRoadmaps.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <Zap className="w-20 h-20 text-orange-300 mb-4" />
          <p className="text-gray-800 text-lg" style={{ fontFamily: "'Baloo 2', cursive" }}>
            No popular roadmaps found yet. Be the first to generate one!
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {popularRoadmaps && popularRoadmaps.map((roadmap, index) => {
          const icons = [Target, TrendingUp, Sparkles, Map];
          const Icon = icons[index % icons.length];
          const gradients = [
            'from-orange-400 to-red-500',
            'from-purple-400 to-pink-500',
            'from-blue-400 to-cyan-500',
            'from-green-400 to-emerald-500'
          ];
          const gradient = gradients[index % gradients.length];

          return (
            <div
              key={roadmap.id}
              onClick={() => setSelectedRoadmap({ 
                ...roadmap.roadmap_json, 
                id: roadmap.id, 
                upvotes: roadmap.upvotes, 
                user_id: roadmap.user_id 
              })}
              className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden aspect-square flex flex-col"
            >
              {/* Decorative gradient header */}
              <div className={`h-32 bg-linear-to-br ${gradient} relative overflow-hidden`}>
                <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity" />
                <div className="absolute top-4 right-4">
                  <Icon className="w-12 h-12 text-white opacity-80" />
                </div>
                {/* Decorative circles */}
                <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white opacity-20 rounded-full" />
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-white opacity-10 rounded-full" />
              </div>

              {/* Content area */}
              <div className="flex-1 p-6 flex flex-col justify-between">
                <div>
                  <h3 
                    className="text-xl font-bold text-gray-800 mb-3 line-clamp-3 group-hover:text-orange-600 transition-colors"
                    style={{ fontFamily: "'Baloo 2', cursive" }}
                  >
                    {roadmap.goal}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="w-4 h-4" />
                      <span>{roadmap.upvotes || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Map className="w-4 h-4" />
                      <span>Roadmap</span>
                    </div>
                  </div>
                </div>

                {/* View button */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div 
                    className="text-orange-500 font-semibold text-center group-hover:text-orange-600 transition-colors flex items-center justify-center gap-2"
                    style={{ fontFamily: "'Baloo 2', cursive" }}
                  >
                    View Full Roadmap
                    <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </div>

              {/* Hover effect overlay */}
              <div className="absolute inset-0 border-4 border-transparent group-hover:border-orange-400 rounded-2xl transition-all pointer-events-none" />
            </div>
          );
        })}
      </div>
    </div>
  )
}