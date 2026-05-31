import fs from 'fs';
import path from 'path';

/**
 * Save a file from a URL (Telegram file URL) to local storage.
 * Returns the public URL path: /uploads/ktm/user_ktm.jpg
 */
export async function uploadFromUrl(
  url: string,
  options: { folder: string; public_id: string }
): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch file from Telegram: ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());

  // Determine subfolder (e.g. 'unnes-shuttle/ktm' -> 'ktm')
  const subFolder = options.folder.replace('shuttle-bot/', '');
  
  // Resolve physical path on the VPS
  // The uploads directory will be at the root of the 'bot' directory: bot/uploads/
  const uploadDir = path.resolve('uploads', subFolder);

  // Ensure directory exists recursively
  fs.mkdirSync(uploadDir, { recursive: true });

  // Use .jpg for photos from Telegram
  const ext = '.jpg';
  const fileName = `${options.public_id}${ext}`;
  const filePath = path.join(uploadDir, fileName);

  // Write file to VPS disk
  fs.writeFileSync(filePath, buffer);

  // Return local public relative URL path
  return `/uploads/${subFolder}/${fileName}`;
}
