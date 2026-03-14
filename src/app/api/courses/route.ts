import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listCourseFolders,
  createCourseFolder,
  SpaceType,
} from "@/lib/drive";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const space = (request.nextUrl.searchParams.get("space") ?? "School") as SpaceType;

  try {
    const courses = await listCourseFolders(session.accessToken, space);
    return NextResponse.json(courses);
  } catch (error) {
    console.error("Error listing courses:", error);
    return NextResponse.json(
      { error: "Failed to list courses" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name, space } = await request.json();
    if (!name) {
      return NextResponse.json(
        { error: "Course name is required" },
        { status: 400 }
      );
    }

    const course = await createCourseFolder(
      session.accessToken,
      name,
      (space ?? "School") as SpaceType
    );
    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    console.error("Error creating course:", error);
    return NextResponse.json(
      { error: "Failed to create course" },
      { status: 500 }
    );
  }
}
