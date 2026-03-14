import { google, drive_v3 } from "googleapis";

const CATEGORY_FOLDERS = [
  "Hoca Materyalleri",
  "Kendi Notlarım",
  "AI Notları",
] as const;

export type CategoryName = (typeof CATEGORY_FOLDERS)[number];
export type SpaceType = "School" | "Work";

const ROOT_FOLDER_NAME = "StudySite";

function getDriveClient(accessToken: string): drive_v3.Drive {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
}

// ─── Root Folder ───────────────────────────────────────────────

async function findFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId?: string
): Promise<string | null> {
  const qParts = [
    `name='${name}'`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
  ];
  if (parentId) qParts.push(`'${parentId}' in parents`);

  const res = await drive.files.list({
    q: qParts.join(" and "),
    fields: "files(id, name)",
    spaces: "drive",
  });

  return res.data.files?.[0]?.id ?? null;
}

async function createFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId?: string
): Promise<string> {
  const requestBody: drive_v3.Schema$File = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) requestBody.parents = [parentId];

  const res = await drive.files.create({
    requestBody,
    fields: "id",
  });
  return res.data.id!;
}

export async function getOrCreateRootFolder(
  accessToken: string
): Promise<string> {
  const drive = getDriveClient(accessToken);

  let rootId = await findFolder(drive, ROOT_FOLDER_NAME);
  if (!rootId) {
    rootId = await createFolder(drive, ROOT_FOLDER_NAME);
  }

  // Ensure School and Work sub-folders exist
  for (const space of ["School", "Work"] as SpaceType[]) {
    const spaceId = await findFolder(drive, space, rootId);
    if (!spaceId) {
      await createFolder(drive, space, rootId);
    }
  }

  return rootId;
}

// ─── Space Folders ─────────────────────────────────────────────

async function getSpaceFolderId(
  accessToken: string,
  space: SpaceType
): Promise<string> {
  const drive = getDriveClient(accessToken);
  const rootId = await getOrCreateRootFolder(accessToken);
  let spaceId = await findFolder(drive, space, rootId);
  if (!spaceId) {
    spaceId = await createFolder(drive, space, rootId);
  }
  return spaceId;
}

// ─── Course Folders ────────────────────────────────────────────

export async function createCourseFolder(
  accessToken: string,
  courseName: string,
  space: SpaceType
): Promise<{ id: string; name: string }> {
  const drive = getDriveClient(accessToken);
  const spaceId = await getSpaceFolderId(accessToken, space);

  const courseId = await createFolder(drive, courseName, spaceId);

  // Create the 3 category sub-folders
  for (const cat of CATEGORY_FOLDERS) {
    await createFolder(drive, cat, courseId);
  }

  return { id: courseId, name: courseName };
}

export interface CourseFolder {
  id: string;
  name: string;
  createdTime: string;
}

export async function listCourseFolders(
  accessToken: string,
  space: SpaceType
): Promise<CourseFolder[]> {
  const drive = getDriveClient(accessToken);
  const spaceId = await getSpaceFolderId(accessToken, space);

  const res = await drive.files.list({
    q: `'${spaceId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name, createdTime)",
    orderBy: "name",
    spaces: "drive",
  });

  return (res.data.files ?? []).map((f) => ({
    id: f.id!,
    name: f.name!,
    createdTime: f.createdTime!,
  }));
}

export async function renameCourseFolder(
  accessToken: string,
  courseId: string,
  newName: string
): Promise<void> {
  const drive = getDriveClient(accessToken);
  await drive.files.update({
    fileId: courseId,
    requestBody: { name: newName },
  });
}

export async function deleteCourseFolder(
  accessToken: string,
  courseId: string
): Promise<void> {
  const drive = getDriveClient(accessToken);
  await drive.files.update({
    fileId: courseId,
    requestBody: { trashed: true },
  });
}

// ─── Category Sub-Folders ──────────────────────────────────────

export interface CategoryInfo {
  id: string;
  name: CategoryName;
}

export async function getCategoryFolders(
  accessToken: string,
  courseId: string
): Promise<CategoryInfo[]> {
  const drive = getDriveClient(accessToken);

  const res = await drive.files.list({
    q: `'${courseId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  return (res.data.files ?? [])
    .filter((f) => CATEGORY_FOLDERS.includes(f.name as CategoryName))
    .map((f) => ({
      id: f.id!,
      name: f.name as CategoryName,
    }));
}

// ─── Files ─────────────────────────────────────────────────────

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  createdTime: string;
  webViewLink: string;
}

export async function listFiles(
  accessToken: string,
  folderId: string
): Promise<DriveFile[]> {
  const drive = getDriveClient(accessToken);

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id, name, mimeType, size, createdTime, webViewLink)",
    orderBy: "createdTime desc",
    spaces: "drive",
  });

  return (res.data.files ?? []).map((f) => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType!,
    size: f.size ?? "0",
    createdTime: f.createdTime!,
    webViewLink: f.webViewLink ?? "",
  }));
}

export async function uploadFile(
  accessToken: string,
  folderId: string,
  fileName: string,
  mimeType: string,
  body: Buffer | ReadableStream | Uint8Array
): Promise<DriveFile> {
  const drive = getDriveClient(accessToken);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: body as unknown as NodeJS.ReadableStream,
    },
    fields: "id, name, mimeType, size, createdTime, webViewLink",
  });

  return {
    id: res.data.id!,
    name: res.data.name!,
    mimeType: res.data.mimeType!,
    size: res.data.size ?? "0",
    createdTime: res.data.createdTime!,
    webViewLink: res.data.webViewLink ?? "",
  };
}

export async function deleteFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  const drive = getDriveClient(accessToken);
  await drive.files.update({
    fileId,
    requestBody: { trashed: true },
  });
}

export async function getCourseFolderName(
  accessToken: string,
  courseId: string
): Promise<string> {
  const drive = getDriveClient(accessToken);
  const res = await drive.files.get({
    fileId: courseId,
    fields: "name",
  });
  return res.data.name!;
}
