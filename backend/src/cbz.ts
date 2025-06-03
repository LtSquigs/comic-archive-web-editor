import { ArchiveEntry, ArchiveReader, ArchiveWriter } from './types.js';
import fs from 'fs';
import archiver, { Archiver } from 'archiver';
import temp from 'temp';
import { Readable, Writable } from 'stream';
import yauzl, { Entry, ZipFile } from 'yauzl';
import { Mutex } from 'async-mutex';
import path from 'path';

temp.track();

export class CBZWriter implements ArchiveWriter {
  static extensions = ['.cbz', '.zip'];
  writer: Archiver;
  tempStream: Writable;
  tempPath: string;
  signal?: AbortSignal;
  aborted: boolean;
  abortHandler: (() => {}) | null;

  constructor(signal?: AbortSignal) {
    temp.cleanupSync();
    this.tempStream = temp.createWriteStream();
    this.writer = archiver('zip', {
      zlib: { level: 9 },
    });
    this.tempPath = (this.tempStream as any).path;
    this.writer.pipe(this.tempStream);
    this.aborted = false;
    this.signal = signal;
    this.abortHandler = async () => {
      this.writer.destroy();
      this.tempStream.destroy();
      this.aborted = true;
      temp.cleanupSync();
      if (this.abortHandler !== null)
        signal?.removeEventListener('abort', this.abortHandler);
      this.abortHandler = null;
    };
    signal?.addEventListener('abort', this.abortHandler);
  }
  async add(path: string, stream: Readable) {
    if (this.aborted) return;
    this.writer.append(stream, { name: path });
  }

  async write(file: string): Promise<void> {
    if (this.aborted) return;
    return new Promise(async (resolve, reject) => {
      this.tempStream.on('close', () => {
        try {
          if (this.aborted) return;
          if (this.abortHandler !== null)
            this.signal?.removeEventListener('abort', this.abortHandler);

          const exists = fs.existsSync(file);
          let cleanup = false;
          if (exists) {
            fs.copyFileSync(file, file + '.bak');
            cleanup = true;
          }

          fs.copyFileSync(this.tempPath, file);
          fs.unlinkSync(this.tempPath);

          if (cleanup) {
            fs.unlinkSync(file + '.bak');
          }
        } catch (e) {
          reject(e);
          return;
        }

        resolve();
      });

      this.tempStream.on('error', (e) => {
        if (this.abortHandler !== null)
          this.signal?.removeEventListener('abort', this.abortHandler);
        reject(e);
      });

      this.writer.on('error', (e) => {
        if (this.abortHandler !== null)
          this.signal?.removeEventListener('abort', this.abortHandler);
      });

      if (this.aborted) return;
      await this.writer.finalize();
    });
  }
}

export class CBZReader implements ArchiveReader {
  static extensions = ['.cbz', '.zip'];
  file: string;
  reader: ZipFile | null;
  internalEntries: ArchiveEntry[];
  readEntries: boolean;
  readingMutex: Mutex;

  constructor(file: string, signal?: AbortSignal) {
    this.file = file;
    this.reader = null;
    this.internalEntries = [];
    this.readEntries = false;
    this.readingMutex = new Mutex();
  }

  async entries(): Promise<ArchiveEntry[]> {
    return this.readingMutex.runExclusive(() => {
      if (this.readEntries) {
        return this.internalEntries;
      }

      return new Promise<ArchiveEntry[]>((resolve, reject) => {
        yauzl.open(
          this.file,
          { lazyEntries: true, autoClose: false },
          (err, zipFile) => {
            if (err) {
              reject(err);
            }

            this.reader = zipFile;

            zipFile.on('entry', (entry: Entry) => {
              // OSX Util Makes these weird directories that we just dont care about
              if (
                entry.fileName.startsWith('__MACOSX/') ||
                entry.fileName.endsWith('.DS_STORE') ||
                path.basename(entry.fileName).startsWith('.')
              ) {
                zipFile.readEntry();
                return;
              }
              this.internalEntries.push({
                filename: entry.fileName,
                directory: entry.fileName[entry.fileName.length - 1] === '/',
                size: entry.uncompressedSize,
                getData: async () => {
                  return new Promise((resolve, reject) => {
                    zipFile.openReadStream(entry, (err, stream) => {
                      if (err) {
                        reject(err);
                        return;
                      }
                      resolve(stream);
                    });
                  });
                },
              });

              zipFile.readEntry();
            });

            zipFile.on('end', () => {
              this.readEntries = true;
              resolve(this.internalEntries);
            });

            zipFile.on('error', (err) => {
              reject(err);
            });

            zipFile.readEntry();
          }
        );
      });
    });
  }
  async close() {
    if (this.reader) this.reader.close();
    this.reader = null;
    this.internalEntries = [];
    this.readEntries = false;
  }
}
