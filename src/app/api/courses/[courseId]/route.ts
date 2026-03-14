import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { renameCourseFolder, deleteCourseFolder } from "@/lib/drive";

interface Params {
  params: Promise<{ courseId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId } = await params;

  try {
    const { name } = await request.json();
    if (!name) {
      return NextResponse.json(
        { error: "New name is required" },
        { status: 400 }
      );
    }

    await renameCourseFolder(session.accessToken, courseId, name);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error renaming course:", error);
    return NextResponse.json(
      { error: "Failed to rename course" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId } = await params;

  try {
    await deleteCourseFolder(session.accessToken, courseId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting course:", error);
    return NextResponse.json(
      { error: "Failed to delete course" },
      { status: 500 }
    );
  }
}
