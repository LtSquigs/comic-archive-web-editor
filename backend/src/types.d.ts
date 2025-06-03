import fileUpload from 'express-fileupload';
import { Readable } from 'stream';

export type ArchiveEntry = {
  filename: string;
  directory: boolean;
  size: number;
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
  signal?: AbortSignal,
  files?: fileUpload.FileArray | null
) => Promise<RouteResponse>;
