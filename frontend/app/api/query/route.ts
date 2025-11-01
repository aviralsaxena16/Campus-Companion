import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { pipeline } from "@xenova/transformers";

const EXPIRY_MS = 120 * 1000; // 120 seconds

// 🧠 Embedding class (same as upload)
class XenovaEmbeddings {
  async embedQuery(text: string): Promise<number[]> {
    const pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    const output = await pipe(text, { pooling: "mean", normalize: true });
    return Array.from(output.data);
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return Promise.all(documents.map((doc) => this.embedQuery(doc)));
  }
}

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { query, user_email } = await request.json();

    if (!query || !user_email) {
      return NextResponse.json(
        { detail: "Missing 'query' or 'user_email'" },
        { status: 400 }
      );
    }

    console.log(`🔍 Querying for: "${query}" by user: ${user_email}`);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const embeddings = new XenovaEmbeddings();

    const vectorStore = await SupabaseVectorStore.fromExistingIndex(embeddings, {
      client: supabase,
      tableName: "documents",
      queryName: "match_documents",
    });

    // fetch current time to apply expiry filter
    const now = Date.now();

    // ⚡ Perform similarity search (with expiry filter)
    const results = await vectorStore.similaritySearch(query, 4, {
      user_id: user_email,
    });

    // 🕒 filter out expired chunks
    const recentResults = results.filter((r) => {
      const uploaded = Number(r.metadata?.uploaded_at || 0);
      return now - uploaded <= EXPIRY_MS;
    });

    if (!recentResults.length) {
      return NextResponse.json({
        answer: "No valid recent PDF context found (expired or missing).",
      });
    }

    const combinedText = recentResults.map((r) => r.pageContent).join("\n\n");
    console.log(`✅ Found ${recentResults.length} relevant chunks.`);

    return NextResponse.json({
      answer: combinedText,
      chunksFound: recentResults.length,
      info: "Used only PDFs uploaded within last 120 seconds.",
    });
  } catch (err) {
    console.error("❌ Error querying document:", err);
    return NextResponse.json(
      { detail: (err as Error).message },
      { status: 500 }
    );
  }
}
