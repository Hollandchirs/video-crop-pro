import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Supabase configuration
const SUPABASE_URL = "https://zapdbgalevtqvpjmtgyq.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZkIGtUTz0ZtZigr1eH4Nnw_QBda6ddE";

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const runtime = "edge";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const filename = formData.get("filename") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    // Files are stored in 'videos' bucket
    const { data, error } = await supabase.storage
      .from("videos")
      .upload(filename, buffer, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return NextResponse.json(
        { error: `Upload failed: ${error.message}` },
        { status: 500 }
      );
    }

    // Get public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from("videos")
      .getPublicUrl(filename);

    return NextResponse.json({
      success: true,
      downloadUrl: publicUrl,
      filename,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}

// Check if file exists in storage
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");

  if (!filename) {
    return NextResponse.json({ error: "Filename required" }, { status: 400 });
  }

  try {
    // Check if file exists by trying to get its info
    const { data } = await supabase.storage
      .from("videos")
      .list(filename, { limit: 1 });

    const exists = data && data.length > 0;

    if (exists) {
      const fileData = data[0];
      // Construct public URL
      const { data: { publicUrl } } = supabase.storage
        .from("videos")
        .getPublicUrl(filename);

      return NextResponse.json({
        exists: true,
        downloadUrl: publicUrl,
        size: fileData.metadata?.size,
      });
    }

    return NextResponse.json({ exists: false });
  } catch {
    return NextResponse.json({ exists: false });
  }
}
