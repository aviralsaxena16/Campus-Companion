import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { type Document } from "@langchain/core/documents";

export const maxDuration = 60;
export const runtime = "nodejs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing Supabase environment variables.");
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

const embeddings = new HuggingFaceInferenceEmbeddings({
  apiKey: process.env.HF_API_KEY!,
  model: "sentence-transformers/all-MiniLM-L6-v2",
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const userEmail = (formData.get("user_email") as string) || "test@example.com";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    console.log(`📄 Processing file: ${file.name}`);

    // --- Load and split PDF ---
    const loader = new PDFLoader(file);
    const docs = await loader.load();
    if (!docs.length) {
      return NextResponse.json({ error: "Could not parse text from PDF" }, { status: 400 });
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const split_docs = await splitter.splitDocuments(docs);

    // --- Add metadata (user info + timestamp) ---
    const uploadedAt = new Date().toISOString();
    const docsWithMetadata: Document[] = split_docs.map((d: Document, i: number) => ({
      ...d,
      metadata: {
        ...d.metadata,
        user_id: userEmail,
        file_name: file.name,
        chunk_index: i,
        uploaded_at: uploadedAt, // ✅ added timestamp
      },
    }));

    console.log(`🧩 Created ${docsWithMetadata.length} chunks.`);

    // --- Generate embeddings ---
    const contents = docsWithMetadata.map((doc) => doc.pageContent);
    console.log(`Embedding ${contents.length} chunks...`);
    const doc_embeddings = await embeddings.embedDocuments(contents);

    // --- Prepare data for Supabase ---
    const data_to_insert = docsWithMetadata.map((doc, i) => ({
      user_id: userEmail,
      file_name: file.name,
      content: contents[i],
      embedding: doc_embeddings[i],
      metadata: doc.metadata,
    }));

    console.log(`Storing ${data_to_insert.length} vectors in Supabase...`);
    const { error } = await supabase.from("documents").insert(data_to_insert);
    if (error) throw new Error(`Supabase insert error: ${error.message}`);

    console.log("✅ Successfully stored documents.");
    return NextResponse.json({
      message: "File processed and stored successfully",
      file_name: file.name,
      uploaded_at: uploadedAt,
      chunks_created: docsWithMetadata.length,
    });
  } catch (error: any) {
    console.error("❌ Upload error:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed", stack: error.stack },
      { status: 500 }
    );
  }
}
