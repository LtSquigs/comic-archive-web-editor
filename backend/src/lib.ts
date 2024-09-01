import ExifTransformer from 'exif-be-gone';
import { Readable } from 'stream';
import { CBZReader, CBZWriter } from './cbz.js';
import path from 'path';
import fs from 'fs';

export const SERVER_HOST = process.env.HOST ?? 'localhost';
export const SERVER_PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
export const SERVER_DIR = path.resolve(process.env.ARCHIVE_DIR ?? '/archives');
export const ALLOWED_EXTENSIONS = CBZReader.extensions;
export const REGISTERED_READERS = [CBZReader];
export const REGISTERED_WRITERS = [CBZWriter];

export const removeExif = (buf: Buffer): Promise<Buffer> => {
  return new Promise(async (resolve, reject) => {
    const transformer = new (ExifTransformer as any)();
    const readable = Readable.from(buf);
    const chunks: any[] = [];

    readable.pipe(transformer);
    transformer.on('data', (chunk: any) => {
      chunks.push(chunk);
    });

    transformer.on('end', async () => {
      resolve(Buffer.concat(chunks));
    });

    transformer.on('error', (err: any) => {
      reject(err);
    });
  });
};

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

export const getArchivesRelative = async (relativeDir: string) => {
  const baseDir = path.join(SERVER_DIR, relativeDir);
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
      const replacer = new RegExp(
        `^${escapeRegExp(SERVER_DIR + path.sep) + '?'}`,
        ''
      );
      return {
        directory: entry.isDirectory(),
        name: entry.name,
        parentPath: entry.parentPath.replace(replacer, ''),
        path: path.join(entry.parentPath.replace(replacer, ''), entry.name),
      };
    });
};

export const resolveFiles = (files: string[]) => {
  const fileNames = files.map((file) => {
    // Normalizes away path traversal
    const normalized = path.join('/', file);
    const fullName = path.join(SERVER_DIR, normalized);

    return { file, resolved: fullName };
  });

  if (fileNames.length === 0) {
    throw new Error('FILE DOES NOT EXIST');
  }

  return fileNames;
};
