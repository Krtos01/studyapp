import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCourseFolderName } from "@/lib/drive";

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
    const name = await getCourseFolderName(session.accessToken, courseId);
    return NextResponse.json({ name });
  } catch (error) {
    console.error("Error getting course name:", error);
    return NextResponse.json(
      { error: "Failed to get course name" },
      { status: 500 }
    );
  }
}
