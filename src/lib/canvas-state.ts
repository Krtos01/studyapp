import { google, drive_v3 } from "googleapis";

const CANVAS_FILE_NAME = ".studysite-canvas.json";

export interface CanvasNodeData {
  fileId: string;
  fileName: string;
  mimeType: string;
  category: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface CanvasLinkData {
  id: string;
  from: string;
  to: string;
}

export interface CanvasState {
  nodes: CanvasNodeData[];
  links: CanvasLinkData[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
}

const DEFAULT_STATE: CanvasState = {
  nodes: [],
  links: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

function getDriveClient(accessToken: string): drive_v3.Drive {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
}

async function findCanvasFile(
  drive: drive_v3.Drive,
  courseId: string
): Promise<string | null> {
  const res = await drive.files.list({
    q: `'${courseId}' in parents and name='${CANVAS_FILE_NAME}' and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });
  return res.data.files?.[0]?.id ?? null;
}

export async function loadCanvasState(
  accessToken: string,
  courseId: string
): Promise<CanvasState> {
  const drive = getDriveClient(accessToken);
  const fileId = await findCanvasFile(drive, courseId);

  if (!fileId) return { ...DEFAULT_STATE };

  try {
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "text" }
    );
    return JSON.parse(res.data as string);
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function saveCanvasState(
  accessToken: string,
  courseId: string,
  state: CanvasState
): Promise<void> {
  const drive = getDriveClient(accessToken);
  const fileId = await findCanvasFile(drive, courseId);
  const content = JSON.stringify(state, null, 2);

  const { Readable } = await import("stream");
  const stream = new Readable();
  stream.push(content);
  stream.push(null);

  if (fileId) {
    await drive.files.update({
      fileId,
      media: {
        mimeType: "application/json",
        body: stream,
      },
    });
  } else {
    await drive.files.create({
      requestBody: {
        name: CANVAS_FILE_NAME,
        parents: [courseId],
        mimeType: "application/json",
      },
      media: {
        mimeType: "application/json",
        body: stream,
      },
    });
  }
}
