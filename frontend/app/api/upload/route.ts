import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { type Document } from "@langchain/core/documents";
import fs from "fs/promises";
import path from "path";
import os from "os";

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
    const userEmail =
      (formData.get("user_email") as string) || "test@example.com";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    console.log(`📄 Processing file: ${file.name}`);

    // --- Save uploaded file temporarily
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pdf-upload-"));
    const tempPath = path.join(tempDir, file.name);
    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(tempPath, Buffer.from(arrayBuffer));

    // --- Load and split PDF ---
    const loader = new PDFLoader(tempPath);
    const docs = await loader.load();

    if (!docs.length) {
      throw new Error("Could not parse any text from PDF");
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const split_docs = await splitter.splitDocuments(docs);

    // --- Add metadata (user info + timestamp) ---
    const uploadedAt = new Date().toISOString();
    const docsWithMetadata: Document[] = split_docs.map(
      (d: Document, i: number) => ({
        ...d,
        metadata: {
          ...d.metadata,
          user_id: userEmail,
          file_name: file.name,
          chunk_index: i,
          uploaded_at: uploadedAt,
        },
      })
    );

    console.log(`🧩 Created ${docsWithMetadata.length} chunks.`);

    // --- Generate embeddings ---
    const contents = docsWithMetadata.map((doc) => doc.pageContent);
    console.log(`⚙️ Generating embeddings for ${contents.length} chunks...`);
    const doc_embeddings = await embeddings.embedDocuments(contents);

    // --- Prepare data for Supabase ---
    const data_to_insert = docsWithMetadata.map((doc, i) => ({
      user_id: userEmail,
      file_name: file.name,
      content: contents[i],
      embedding: doc_embeddings[i],
      metadata: doc.metadata,
    }));

    console.log(`🗃️ Storing ${data_to_insert.length} vectors in Supabase...`);

    // --- Retry logic for Supabase insert ---
    let attempt = 0;
    const maxAttempts = 3;
    let insertError: Error | null = null;

    while (attempt < maxAttempts) {
      const { error } = await supabase.from("documents").insert(data_to_insert);
      if (!error) {
        insertError = null;
        break;
      }
      insertError = error;
      attempt++;
      console.warn(
        `⚠️ Supabase insert attempt ${attempt} failed: ${error.message}`
      );
      await new Promise((res) => setTimeout(res, 1000 * attempt)); // exponential backoff
    }

    if (insertError) {
      throw new Error(
        `Supabase insert failed after ${maxAttempts} attempts: ${insertError.message}`
      );
    }

    console.log("✅ Successfully stored documents.");

    // --- Clean up temporary file ---
    await fs.unlink(tempPath).catch(() => {});
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

    return NextResponse.json({
      message: "File processed and stored successfully",
      file_name: file.name,
      uploaded_at: uploadedAt,
      chunks_created: docsWithMetadata.length,
    });
  } catch (err: unknown) {
    console.error("❌ Upload error:", err);

    const errorMessage =
      err instanceof Error ? err.message : "Upload failed";
    const errorStack =
      err instanceof Error ? err.stack : undefined;

    return NextResponse.json(
      { error: errorMessage, stack: errorStack },
      { status: 500 }
    );
  }
}
