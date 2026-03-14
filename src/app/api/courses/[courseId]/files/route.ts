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
