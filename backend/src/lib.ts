import ExifTransformer from 'exif-be-gone';
import { Readable, Transform } from 'stream';
import { CBZReader, CBZWriter } from './cbz.js';
import path from 'path';
import fs from 'fs';

export const SERVER_HOST = process.env.HOST ?? 'localhost';
export const SERVER_PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
export const STATIC_PATH = 'public';
export const SERVER_DIR = path.resolve(process.env.ARCHIVE_DIR ?? '/archives');
export const ALLOWED_EXTENSIONS = CBZReader.extensions;
export const REGISTERED_READERS = [CBZReader];
export const REGISTERED_WRITERS = [CBZWriter];

export const removeExif = (readable: Readable): Readable => {
  const transformer: Transform = new (ExifTransformer as any)();
  readable.pipe(transformer);
  return transformer;
};

export const getArchivesRelative = async (relativeDir: string) => {
  const normalized = path.join('/', relativeDir);
  const baseDir = path.join(SERVER_DIR, normalized);
  const pathTraversal = !baseDir.startsWith(SERVER_DIR);

  if (pathTraversal) {
    return [];
  }

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });

  return entries
    .filter((entry) => {
      if (
        !entry.isDirectory() &&
        !ALLOWED_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())
      )
        return false;

      return true;
    })
    .map((entry) => {
      return {
        directory: entry.isDirectory(),
        name: entry.name,
        parentPath: entry.parentPath.replace(SERVER_DIR + path.sep, ''),
        path: path.join(
          entry.parentPath.replace(SERVER_DIR + path.sep, ''),
          entry.name
        ),
      };
    });
};

export const resolveFiles = (files: string[]) => {
  const fileNames = files
    .map((file) => {
      // Normalizes away path traversal
      const normalized = path.join('/', file);
      const fullName = path.join(SERVER_DIR, normalized);
      const pathTraversal = !fullName.startsWith(SERVER_DIR);

      if (pathTraversal) {
        return null;
      }

      return { file, resolved: fullName };
    })
    .filter((x) => x !== null);

  if (fileNames.length === 0) {
    throw new Error('FILE DOES NOT EXIST');
  }

  return fileNames as { file: string; resolved: string }[];
};
