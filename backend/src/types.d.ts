import { Readable } from 'stream';

export type ArchiveEntry = {
  filename: string;
  directory: boolean;
  getData: () => Promise<Readable>;
};

export interface ArchiveReader {
  entries(): Promise<ArchiveEntry[]>;
  close(): void;
}

export interface ArchiveWriter {
  add(path: string, stream: Readable): Promise<void>;
  write(file: string): Promise<void>;
}

export type RouteResponse =
  | {
      type: 'json';
      body: object;
    }
  | {
      type: 'stream';
      mime: string;
      body: Readable;
    }
  | null;

type RouteHandler = (
  params: any,
  body: any,
  signal?: AbortSignal
) => Promise<RouteResponse>;
