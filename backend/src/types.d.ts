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

type routeResponse =
  | {
      type: 'json';
      body: object;
    }
  | {
      type: 'raw';
      mime: string;
      body: Buffer;
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
