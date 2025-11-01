import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
// --- 1. Import Xenova (HuggingFace) ---
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { type Document } from "@langchain/core/documents";

export const maxDuration = 60;
export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    "Missing Supabase env vars. Ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const userEmail = (formData.get("user_email") as string) || "test@example.com";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    console.log(`📄 Processing file: ${file.name}`);

    // --- parse pdf -> docs
    const loader = new PDFLoader(file);
    const docs = await loader.load();
    if (!docs || docs.length === 0) {
      return NextResponse.json({ error: "Could not parse text from PDF" }, { status: 400 });
    }

    // --- split
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const split_docs = await splitter.splitDocuments(docs);

    // --- attach metadata (⏱️ add timestamp)
    const uploadedAt = Date.now();
    const docsWithMetadata = split_docs.map((d: Document, i: number) => ({
      ...d,
      metadata: {
        ...d.metadata,
        user_id: userEmail,
        file_name: file.name,
        chunk_index: i,
        uploaded_at: uploadedAt, // ⏱️
      },
    }));

    console.log(`🧩 Created ${docsWithMetadata.length} chunks.`);

    // --- 2. Use Xenova Embeddings ---
    const embeddings = new HuggingFaceInferenceEmbeddings({
      apiKey: process.env.HF_API_KEY!, // create at https://huggingface.co/settings/tokens
      model: "sentence-transformers/all-MiniLM-L6-v2",
    });

    console.log("🪣 Attempting SupabaseVectorStore.fromDocuments...");
    const testEmbedding = await embeddings.embedQuery("test");
    console.log("🧠 Test embedding vector length:", testEmbedding.length);

    try {
      const vectorStore = await SupabaseVectorStore.fromDocuments(
        docsWithMetadata,
        embeddings,
        {
          client: supabase,
          tableName: "documents",
          queryName: "match_documents",
        }
      );

      console.log("✅ fromDocuments returned:", !!vectorStore);
      return NextResponse.json({
        message: "File processed and embeddings stored successfully",
        file_name: file.name,
        chunks_created: docsWithMetadata.length,
        uploaded_at: uploadedAt,
        expires_in: "120 seconds",
      });
    } catch (insertErr: any) {
      console.error("Error inserting via SupabaseVectorStore.fromDocuments:", insertErr);

      const details =
        insertErr && typeof insertErr === "object"
          ? {
              message: insertErr.message ?? String(insertErr),
              stack: insertErr.stack,
              response: (insertErr as any).response ?? undefined,
              status: (insertErr as any).status ?? undefined,
            }
          : String(insertErr);

      return NextResponse.json(
        {
          error: "Error inserting vectors into Supabase (detailed info in server logs).",
          insertErrorSummary: details,
          suggestion:
            "Common causes: network blocked, wrong Supabase URL/key, missing pgvector extension or missing 'match_documents' rpc, or insufficient DB permissions.",
        },
        { status: 502 }
      );
    }
  } catch (error: any) {
    console.error("❌ Upload error:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed", stack: error.stack },
      { status: 500 }
    );
  }
}
