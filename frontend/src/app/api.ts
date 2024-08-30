import { FileTree, Entry, Metadata, JoinEntry, SplitMarker } from './types';

let abortController: AbortController | null = null;
export const abortableRequest = async (
  fn: (signal: AbortSignal) => Promise<any>
): Promise<any> => {
  if (abortController) {
    abortController.abort();
  }
  abortController = new AbortController();
  try {
    return await fn(abortController.signal);
  } catch (error: any) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return false;
    }

    throw error;
  } finally {
    abortController = null;
  }
};

const fileParam = (files: string[] = []) => {
  const params = new URLSearchParams();

  // Iterating the search parameters
  for (const file of files) {
    params.append('files', file);
  }

  return params.toString();
};

export class API {
  static files: string[] = [];

  static setFiles(files: string[]) {
    API.files = files;
  }

  static async getAllCBZ() {
    const resp = await fetch('/cbz/list');
    const body = await resp.json();

    return body.paths as FileTree;
  }

  static async getEntries(): Promise<Entry[]> {
    if (API.files.length !== 1) {
      return [];
    }

    return abortableRequest(async (signal) => {
      const resp = await fetch(`/cbz/entries?${fileParam(API.files)}`, {
        signal,
      });
      const body = await resp.json();

      return body.entries;
    });
  }

  static async renameEntries(map: { [key: string]: string }): Promise<boolean> {
    if (API.files.length !== 1) {
      return false;
    }

    return abortableRequest(async (signal) => {
      const resp = await fetch(`/cbz/entries?${fileParam(API.files)}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(map),
        signal,
      });
      const body = await resp.json();

      return body.success;
    });
  }

  static async flattenEntries(): Promise<boolean> {
    return abortableRequest(async (signal) => {
      const resp = await fetch(`/cbz/flatten?${fileParam(API.files)}`, {
        method: 'POST',
        signal,
      });
      const body = await resp.json();

      return body.success;
    });
  }

  static async removeExif(): Promise<boolean> {
    return abortableRequest(async (signal) => {
      const resp = await fetch(`/cbz/removeExif?${fileParam(API.files)}`, {
        method: 'POST',
        signal,
      });
      const body = await resp.json();

      return body.success;
    });
  }

  static async getMetadata(): Promise<Metadata> {
    if (API.files.length < 1) {
      return {};
    }

    return abortableRequest(async (signal) => {
      const resp = await fetch(`/cbz/metadata?${fileParam(API.files)}`, {
        signal,
      });
      const body = await resp.json();

      return body.metadata;
    });
  }

  static async setMetadata(metadata: Metadata): Promise<boolean> {
    if (API.files.length < 1) {
      return true;
    }

    return abortableRequest(async (signal) => {
      const resp = await fetch(`/cbz/metadata?${fileParam(API.files)}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
        signal,
      });
      const body = await resp.json();

      return body.success;
    });
  }

  static async setBulkMetadata(metadata: {
    [key: string]: Metadata;
  }): Promise<boolean> {
    if (API.files.length < 1) {
      return true;
    }

    return abortableRequest(async (signal) => {
      const resp = await fetch(`/cbz/metadata/bulk`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: API.files, metadata }),
        signal,
      });
      const body = await resp.json();

      return body.success;
    });
  }

  static getCoverUrl(): string {
    if (API.files.length > 1) {
      return '';
    }
    return `/cbz/cover?${fileParam(API.files)}`;
  }

  static async setCover(entry: Entry) {
    return abortableRequest(async (signal) => {
      const resp = await fetch(`/cbz/cover?${fileParam(API.files)}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entry: entry.entryName }),
        signal,
      });
      const body = await resp.json();
      return body.success;
    });
  }

  static async joinImages(joinList: JoinEntry[]) {
    return abortableRequest(async (signal) => {
      const resp = await fetch(`/cbz/image/join?${fileParam(API.files)}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(joinList),
        signal,
      });
      const body = await resp.json();
      return body.success;
    });
  }

  static async delete() {
    return abortableRequest(async (signal) => {
      const resp = await fetch(`/cbz/delete?${fileParam(API.files)}`, {
        method: 'POST',
        signal,
      });
      const body = await resp.json();
      return body.success;
    });
  }

  static async splitArchive(markers: SplitMarker[], entries: Entry[]) {
    const splits: any[] = [];

    markers.sort((a, b) => {
      if (a.startEntry > b.startEntry) {
        return 1;
      }
      if (a.startEntry < b.startEntry) {
        return -1;
      }
      return 0;
    });

    for (let marker of markers) {
      const mapEntry = { suffix: marker.suffix, entries: [] as string[] };

      let inBlock = false;
      for (let entry of entries) {
        if (entry.entryName === marker.startEntry) {
          inBlock = true;
        }

        if (inBlock && entry.isImage && !entry.isDirectory) {
          mapEntry.entries.push(entry.entryName);
        }

        if (entry.entryName === marker.endEntry) {
          inBlock = false;
        }
      }

      splits.push(mapEntry);
    }

    return abortableRequest(async (signal) => {
      const resp = await fetch(`/cbz/split?${fileParam(API.files)}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(splits),
        signal,
      });
      const body = await resp.json();
      return body.success;
    });
  }
}
