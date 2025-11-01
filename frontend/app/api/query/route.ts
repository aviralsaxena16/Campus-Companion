import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const embeddings = new HuggingFaceInferenceEmbeddings({
  apiKey: process.env.HF_API_KEY!,
  model: "sentence-transformers/all-MiniLM-L6-v2",
});

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
});

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Find the most recent document uploaded within the last 120 seconds
    const { data: files, error: fetchError } = await supabase
      .from("documents")
      .select("id, metadata")
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError) throw fetchError;
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No recent document found" },
        { status: 404 }
      );
    }

    const recentFile = files[0];
    const uploadedAt = (recentFile.metadata as any)?.uploaded_at;

    if (!uploadedAt) {
      return NextResponse.json(
        { error: "Missing upload timestamp in metadata" },
        { status: 400 }
      );
    }

    const now = new Date();
    const uploadTime = new Date(uploadedAt);
    const diffInSeconds = (now.getTime() - uploadTime.getTime()) / 1000;

    if (diffInSeconds > 120) {
      return NextResponse.json(
        { error: "No recent upload found (older than 120s)" },
        { status: 404 }
      );
    }

    // Load the most recent document’s embeddings
    const vectorStore = await SupabaseVectorStore.fromExistingIndex(embeddings, {
      client: supabase,
      tableName: "documents",
      queryName: "match_documents",
    });

    const results = await vectorStore.similaritySearch(query, 3);

    const context = results.map((r) => r.pageContent).join("\n");

    const response = await llm.invoke(
      `Answer the user's question using the context below:\n\nContext:\n${context}\n\nQuestion: ${query}`
    );

    // Extract text content before returning, with runtime/type guards
    let answer = "No answer generated.";

    if (typeof response === "string") {
      answer = response;
    } else if (
      response &&
      typeof response === "object" &&
      "content" in response &&
      Array.isArray((response as any).content) &&
      (response as any).content.length > 0
    ) {
      const first = (response as any).content[0];
      if (typeof first === "string") {
        answer = first;
      } else if (first && typeof first === "object" && "text" in first) {
        answer = (first as any).text;
      } else {
        answer = JSON.stringify(first);
      }
    } else if (response && typeof response === "object" && "text" in (response as any)) {
      // handle case where response itself has a text field
      answer = (response as any).text;
    }

    return NextResponse.json({ answer });
  } catch (error: any) {
    console.error("❌ Query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
