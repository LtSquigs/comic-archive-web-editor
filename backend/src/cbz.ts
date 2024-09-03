import { ArchiveEntry, ArchiveReader, ArchiveWriter } from './types.js';
import fs from 'fs';
import archiver, { Archiver } from 'archiver';
import StreamZip, { StreamZipAsync } from 'node-stream-zip';

export class CBZWriter implements ArchiveWriter {
  static extensions = ['.cbz', '.zip'];
  writer: Archiver;

  constructor(signal?: AbortSignal) {
    // Todo potentially create temporary file stream
    this.writer = archiver('zip', {
      zlib: { level: 9 },
    });
  }
  async add(path: string, data: Buffer) {
    this.writer.append(data, { name: path });
  }
  async write(file: string): Promise<void> {
    const output = fs.createWriteStream(file);
    this.writer.pipe(output);
    await this.writer.finalize();
  }
}

export class CBZReader implements ArchiveReader {
  static extensions = ['.cbz', '.zip'];
  file: string;
  reader: StreamZipAsync;

  constructor(file: string, signal?: AbortSignal) {
    this.file = file;
    this.reader = new StreamZip.async({ file: this.file });
  }
  async entries(): Promise<ArchiveEntry[]> {
    const entries: ArchiveEntry[] = [];
    for (const entry of Object.values(await this.reader.entries())) {
      entries.push({
        filename: entry.name,
        directory: entry.isDirectory,
        getData: async () => {
          return await this.reader.entryData(entry);
        },
      });
    }
    return entries;
  }
  async close() {
    await this.reader.close();
  }
}
