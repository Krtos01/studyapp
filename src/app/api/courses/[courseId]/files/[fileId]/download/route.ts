import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { google } from "googleapis";

interface Params {
  params: Promise<{ courseId: string; fileId: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fileId } = await params;

  try {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });
    const drive = google.drive({ version: "v3", auth });

    // 1. Get file metadata to check mimeType
    const metaRes = await drive.files.get({
      fileId,
      fields: "mimeType, name",
    });

    const mimeType = metaRes.data.mimeType;

    // 2. Fetch file content
    let contentRes;

    // Google Workspace documents (Docs, Sheets, Slides) cannot be downloaded directly via alt=media
    // They must be exported.
    if (mimeType?.startsWith("application/vnd.google-apps.")) {
      let exportMimeType = "application/pdf"; // Default export format

      if (mimeType === "application/vnd.google-apps.presentation") {
        exportMimeType = "application/pdf"; // PPTX export is often buggy via API, PDF is safer for preview
      } else if (mimeType === "application/vnd.google-apps.document") {
        exportMimeType = "application/pdf";
      } else if (mimeType === "application/vnd.google-apps.spreadsheet") {
        exportMimeType = "application/pdf";
      }

      contentRes = await drive.files.export(
        {
          fileId,
          mimeType: exportMimeType,
        },
        { responseType: "arraybuffer" }
      );
    } else {
      // Normal files (PDF, images, actual PPTX files)
      contentRes = await drive.files.get(
        {
          fileId,
          alt: "media",
        },
        { responseType: "arraybuffer" }
      );
    }

    // 3. Return as stream/buffer
    const headers = new Headers();
    headers.set("Content-Type", contentRes.headers["content-type"] as string || "application/octet-stream");
    headers.set("Cache-Control", "public, max-age=3600"); // Cache for 1 hour

    return new NextResponse(contentRes.data as ArrayBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Error downloading file:", error);
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    );
  }
}
