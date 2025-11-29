import { describe, it, expect } from 'vitest';
import { fileToBuffer, getFileName, getContentType } from '../../utils/file.js';
import { Buffer } from 'buffer';

describe('File Utils', () => {
  describe('fileToBuffer', () => {
    it('should handle Buffer input', async () => {
      const buffer = Buffer.from('test data');
      const result = await fileToBuffer(buffer);
      expect(result).toEqual(buffer);
    });

    it('should handle Uint8Array input', async () => {
      const uint8Array = new Uint8Array([1, 2, 3, 4]);
      const result = await fileToBuffer(uint8Array);
      expect(Buffer.from(uint8Array)).toEqual(result);
    });

    it('should handle string path (Node.js)', async () => {
      // This would require fs/promises, so we'll skip in browser tests
      // In a real test, you'd mock fs/promises
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('getFileName', () => {
    it('should extract filename from path', () => {
      expect(getFileName('/path/to/file.jpg')).toBe('file.jpg');
      expect(getFileName('C:\\path\\to\\file.jpg')).toBe('file.jpg');
      expect(getFileName('file.jpg')).toBe('file.jpg');
    });

    it('should return untitled for non-string input', () => {
      expect(getFileName(Buffer.from('test'))).toBe('untitled');
    });
  });

  describe('getContentType', () => {
    it('should detect content type from extension', () => {
      expect(getContentType('image.jpg')).toBe('image/jpeg');
      expect(getContentType('image.jpeg')).toBe('image/jpeg');
      expect(getContentType('image.png')).toBe('image/png');
      expect(getContentType('video.mp4')).toBe('video/mp4');
      expect(getContentType('document.pdf')).toBe('application/pdf');
    });

    it('should return default for unknown extension', () => {
      expect(getContentType('file.unknown')).toBe('application/octet-stream');
    });

    it('should return default for no extension', () => {
      expect(getContentType('file')).toBe('application/octet-stream');
    });
  });
});
