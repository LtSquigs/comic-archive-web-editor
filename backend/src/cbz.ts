import { ArchiveEntry, ArchiveReader, ArchiveWriter } from './types.js';
import {
  ZipReader,
  Uint8ArrayReader,
  BlobWriter,
  ZipWriter,
  Uint8ArrayWriter,
} from '@zip.js/zip.js';
import fs from 'fs';

export class CBZWriter implements ArchiveWriter {
  static extensions = ['.cbz', '.zip'];
  writer: Uint8ArrayWriter;
  zipWriter: ZipWriter<Uint8Array>;

  constructor() {
    this.writer = new Uint8ArrayWriter();
    this.zipWriter = new ZipWriter(this.writer);
  }
  async add(path: string, data: Buffer) {
    const bw = new BlobWriter();
    await this.zipWriter.add(path, new Uint8ArrayReader(new Uint8Array(data)));
  }
  async write(): Promise<Buffer> {
    await this.zipWriter.close();
    const data = await this.writer.getData();

    return Buffer.from(data);
  }
}

export class CBZReader implements ArchiveReader {
  static extensions = ['.cbz', '.zip'];
  file: string;
  reader: ZipReader<Uint8Array>;

  constructor(file: string) {
    this.file = file;
    const data = fs.readFileSync(this.file);
    this.reader = new ZipReader(new Uint8ArrayReader(new Uint8Array(data)));
  }
  async entries(): Promise<ArchiveEntry[]> {
    const entries: ArchiveEntry[] = [];
    for (let entry of await this.reader.getEntries()) {
      entries.push({
        filename: entry.filename,
        directory: entry.directory,
        getData: async () => {
          if (!entry.getData) {
            return Buffer.from([]);
          }
          const writer = new Uint8ArrayWriter();
          const data = await entry.getData(writer);
          return Buffer.from(data);
        },
      });
    }
    return entries;
  }
  async close() {
    this.reader.close();
  }
}
