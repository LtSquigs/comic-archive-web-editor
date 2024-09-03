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

type routeResponse =
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

type routeHandler = (
  params: URLSearchParams,
  body: any,
  signal?: AbortSignal
) => Promise<routeResponse>;

export type RouteHandlers =
  | {
      GET?: routeHandler;
      POST?: routeHandler;
    }
  | routeHandler;
