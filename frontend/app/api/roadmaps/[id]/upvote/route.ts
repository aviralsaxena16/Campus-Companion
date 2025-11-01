import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const maxDuration = 60;

// POST /api/roadmaps/[id]/upvote
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: roadmap_id } = params;
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({ detail: "Missing user_id" }, { status: 400 });
    }

    // Call the SQL function we created
    const { data, error } = await supabase.rpc('toggle_roadmap_upvote', {
      p_roadmap_id: roadmap_id,
      p_user_id: user_id
    });

    if (error) {
      throw new Error(error.message);
    }

    // 'data' will be the new upvote count
    return NextResponse.json({ success: true, new_upvote_count: data });

  } catch (error) {
    console.error("Upvote error:", error);
    const errorMessage = (error as Error).message;
    return NextResponse.json({ detail: `Error toggling upvote: ${errorMessage}` }, { status: 500 });
  }
}