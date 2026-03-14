import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { loadCanvasState, saveCanvasState } from "@/lib/canvas-state";

interface Params {
  params: Promise<{ courseId: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId } = await params;

  try {
    const state = await loadCanvasState(session.accessToken, courseId);
    return NextResponse.json(state);
  } catch (error) {
    console.error("Error loading canvas state:", error);
    return NextResponse.json(
      { error: "Failed to load canvas state" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId } = await params;

  try {
    const state = await request.json();
    await saveCanvasState(session.accessToken, courseId, state);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving canvas state:", error);
    return NextResponse.json(
      { error: "Failed to save canvas state" },
      { status: 500 }
    );
  }
}
