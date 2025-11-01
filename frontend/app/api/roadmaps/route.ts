import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const maxDuration = 60;

// POST /api/roadmaps - Saves a new roadmap
export async function POST(request: Request) {
  try {
    const { goal, roadmap_json, user_id } = await request.json();

    if (!goal || !roadmap_json || !user_id) {
      return NextResponse.json({ detail: "Missing goal, roadmap_json, or user_id" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("roadmaps")
      .insert({
        goal: goal,
        roadmap_json: roadmap_json,
        user_id: user_id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true, roadmap: data });

  } catch (error) {
    console.error("Roadmap save error:", error);
    const errorMessage = (error as Error).message;
    return NextResponse.json({ detail: `Error saving roadmap: ${errorMessage}` }, { status: 500 });
  }
}

// GET /api/roadmaps - Gets popular roadmaps
export async function GET(request: NextRequest) {
   try {
    const { data, error } = await supabase
      .from("roadmaps")
      .select("id, goal, roadmap_json, upvotes, user_id") // We can select user_id to show who made it
      .order("upvotes", { ascending: false }) // Order by most upvotes
      .limit(5); // Get top 5

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error("Get popular roadmaps error:", error);
    const errorMessage = (error as Error).message;
    return NextResponse.json({ detail: `Error fetching popular roadmaps: ${errorMessage}` }, { status: 500 });
  }
}