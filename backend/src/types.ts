export type ArchiveEntry = {
  filename: string;
  directory: boolean;
  getData: () => Promise<Buffer>;
};

export interface ArchiveReader {
  entries(): Promise<ArchiveEntry[]>;
  close(): void;
}

export interface ArchiveWriter {
  add(path: string, data: Buffer): Promise<void>;
  write(): Promise<Buffer>;
}
