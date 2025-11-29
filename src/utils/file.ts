/**
 * File utilities
 */
import type { FileInput } from '../types/requests.js';

/**
 * Convert file input to Buffer
 */
export async function fileToBuffer(file: FileInput): Promise<Buffer> {
  if (Buffer.isBuffer(file)) {
    return file;
  }

  if (file instanceof Uint8Array) {
    return Buffer.from(file);
  }

  // Handle Blob/File (browser environment)
  // Use type guards to avoid instanceof issues
  if (typeof Blob !== 'undefined') {
    const fileAsAny = file as any;
    if (fileAsAny instanceof Blob) {
      const arrayBuffer = await fileAsAny.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }
  }

  if (typeof file === 'string') {
    // Assume it's a file path (Node.js only)
    // In browser, this would need to be handled differently
    const fs = await import('fs/promises');
    return await fs.readFile(file);
  }

  throw new Error('Unsupported file type');
}

/**
 * Get file name from file input
 */
export function getFileName(file: FileInput): string {
  if (typeof File !== 'undefined' && file instanceof File) {
    return file.name;
  }

  if (typeof file === 'string') {
    // Extract filename from path (handle both Unix and Windows paths)
    // Try Windows path first (backslash), then Unix path (forward slash)
    const parts = file.split(/[/\\]/);
    const filename = parts[parts.length - 1];
    return filename || 'untitled';
  }

  return 'untitled';
}

/**
 * Get content type from file
 */
export function getContentType(file: FileInput): string {
  if (typeof Blob !== 'undefined' && (file instanceof Blob || (typeof File !== 'undefined' && file instanceof File))) {
    return (file as Blob).type || 'application/octet-stream';
  }

  if (typeof file === 'string') {
    // Try to infer from extension
    const ext = file.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'pdf': 'application/pdf',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  return 'application/octet-stream';
}
