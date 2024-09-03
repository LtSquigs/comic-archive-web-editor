import { ArchiveEntry, ArchiveReader, ArchiveWriter } from './types.js';
import fs from 'fs';
import archiver, { Archiver } from 'archiver';
import temp from 'temp';
import { Readable, Writable } from 'stream';
import yauzl, { Entry, ZipFile } from 'yauzl';
import { Mutex } from 'async-mutex';

temp.track();

export class CBZWriter implements ArchiveWriter {
  static extensions = ['.cbz', '.zip'];
  writer: Archiver;
  tempStream: Writable;
  tempPath: string;

  constructor(signal?: AbortSignal) {
    temp.cleanup();
    this.tempStream = temp.createWriteStream();
    this.writer = archiver('zip', {
      zlib: { level: 9 },
    });
    this.tempPath = (this.tempStream as any).path;
    this.writer.pipe(this.tempStream);
  }
  async add(path: string, stream: Readable) {
    this.writer.append(stream, { name: path });
  }
  async write(file: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      this.tempStream.on('close', () => {
        const exists = fs.existsSync(file);
        if (exists) {
          fs.unlinkSync(file);
        }

        fs.renameSync(this.tempPath, file);

        resolve();
      });

      this.tempStream.on('error', (e) => {
        reject(e);
      });

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
              this.internalEntries.push({
                filename: entry.fileName,
                directory: entry.fileName[entry.fileName.length - 1] === '/',
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
