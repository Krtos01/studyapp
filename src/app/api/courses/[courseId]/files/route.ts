import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getCategoryFolders,
  listFiles,
  uploadFile,
  CategoryName,
} from "@/lib/drive";
import { Readable } from "stream";

interface Params {
  params: Promise<{ courseId: string }>;
}

export const config = {
  api: {
    bodyParser: false, // Disabling Next.js parser to handle large FormData manually or via specialized middleware if needed
    // However, App Router doesn't use `export const config` anymore for this.
    // Instead, it relies on Next.js 14 server config. Let's use `serverActions` or similar if needed.
  },
};

// Next.js App Router body size limit override:
export const maxDuration = 60; // Max execution time for vercel

export async function GET(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId } = await params;
  const category = request.nextUrl.searchParams.get("category") as CategoryName;

  if (!category) {
    return NextResponse.json(
      { error: "Category parameter is required" },
      { status: 400 }
    );
  }

  try {
    const categories = await getCategoryFolders(session.accessToken, courseId);
    const catFolder = categories.find((c) => c.name === category);
    if (!catFolder) {
      return NextResponse.json(
        { error: "Category folder not found" },
        { status: 404 }
      );
    }

    const files = await listFiles(session.accessToken, catFolder.id);
    console.log(`[Drive API Sync] Fetched ${files.length} files for category '${category}' from folder ID: ${catFolder.id}`);
    return NextResponse.json(files);
  } catch (error) {
    console.error("Error listing files:", error);
    return NextResponse.json(
      { error: "Failed to list files" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId } = await params;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = formData.get("category") as CategoryName;

    if (!file || !category) {
      return NextResponse.json(
        { error: "File and category are required" },
        { status: 400 }
      );
    }

    const categories = await getCategoryFolders(session.accessToken, courseId);
    const catFolder = categories.find((c) => c.name === category);
    if (!catFolder) {
      return NextResponse.json(
        { error: "Category folder not found" },
        { status: 404 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Convert Buffer to a readable stream for googleapis using Readable.from
    // This is much safer for Vercel Serverless environments
    const stream = Readable.from(buffer);

    const uploaded = await uploadFile(
      session.accessToken,
      catFolder.id,
      file.name,
      file.type,
      stream as unknown as Buffer
    );

    return NextResponse.json(uploaded, { status: 201 });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
