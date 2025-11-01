import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

interface DocumentMetadata {
  uploaded_at?: string;
  [key: string]: unknown;
}

interface SupabaseDocument {
  id: string;
  metadata: DocumentMetadata;
}

interface LLMResponse {
  content?: Array<{ text?: string } | string>;
  text?: string;
}

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
    const { query }: { query?: string } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

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

    const recentFile = files[0] as SupabaseDocument;
    const uploadedAt = recentFile.metadata?.uploaded_at;

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

    const vectorStore = await SupabaseVectorStore.fromExistingIndex(embeddings, {
      client: supabase,
      tableName: "documents",
      queryName: "match_documents",
    });

    const results = await vectorStore.similaritySearch(query, 4);
    const context = results.map((r) => r.pageContent).join("\n\n---\n\n");

    const prompt = `
You are a highly intelligent assistant helping the user find accurate answers from provided documents.

Follow these rules strictly:
1. Base your answer *only* on the given context unless you are 100% sure of additional facts.
2. If the context does not contain the answer, say: "The provided document does not contain enough information to answer this question."
3. Keep your response clear, factual, and concise — 4-6 sentences max.
4. If the question asks for a summary, provide a short but meaningful summary from the context.
5. If the document includes structured data (tables, numbers, or bullet points), retain that structure in your response.

---
🧾 Context:
${context}

💬 User Question:
${query}

🧩 Your Answer:
`;

    const response = (await llm.invoke(prompt)) as unknown;

    // --- Safe type parsing ---
    let answer = "No answer generated.";

    if (typeof response === "string") {
      answer = response;
    } else if (typeof response === "object" && response !== null) {
      const r = response as LLMResponse;

      if (Array.isArray(r.content) && r.content.length > 0) {
        const first = r.content[0];
        if (typeof first === "string") {
          answer = first;
        } else if (first && typeof first === "object" && typeof first.text === "string") {
          answer = first.text;
        } else {
          answer = JSON.stringify(first);
        }
      } else if (typeof r.text === "string") {
        answer = r.text;
      }
    }

    return NextResponse.json({ answer });
  } catch (error: unknown) {
    console.error("❌ Query error:", error);
    const errMsg =
      error instanceof Error ? error.message : "Unknown server error occurred.";
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
