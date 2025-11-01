import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const maxDuration = 60;

// GET /api/roadmaps/me - Gets roadmaps for the logged-in user
export async function POST(request: NextRequest) {
   try {
    const { user_id } = await request.json();
    if (!user_id) {
      return NextResponse.json({ detail: "Missing user_id" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("roadmaps")
      .select("id, goal, roadmap_json, upvotes, user_id")
      .eq("user_id", user_id) // Filter by user_id
      .order("created_at", { ascending: false }); // Show newest first

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error("Get my roadmaps error:", error);
    const errorMessage = (error as Error).message;
    return NextResponse.json({ detail: `Error fetching my roadmaps: ${errorMessage}` }, { status: 500 });
  }
}