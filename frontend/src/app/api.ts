import { FileEntry, SplitMarker, APIResult } from './types';

import {
  Entry,
  APIMetadata,
  Metadata,
  MetadataMap,
  JoinPair,
  EntryMap,
} from '../shared/types';

let abortController: AbortController | null = null;
export const abortableRequest = async <T>(
  fn: (signal: AbortSignal) => Promise<any>
): Promise<APIResult<T>> => {
  if (abortController) {
    abortController.abort();
  }
  abortController = new AbortController();
  try {
    return await fn(abortController.signal);
  } catch (error: any) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { error: true, errorStr: error.message };
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

  static async getArchiveFiles(
    subdir: string = ''
  ): Promise<APIResult<FileEntry[]>> {
    const params = new URLSearchParams();
    params.append('prefix', subdir);

    const resp = await fetch(`/archive/list?${params.toString()}`);
    const body = await resp.json();

    if (body.error) {
      return { error: true, errorStr: body.error };
    }

    return { data: body.paths, error: false };
  }

  static async getEntries(): Promise<APIResult<Entry[]>> {
    if (API.files.length !== 1) {
      return { data: [], error: false };
    }

    return abortableRequest(async (signal): Promise<APIResult<Entry[]>> => {
      const resp = await fetch(`/archive/entries?${fileParam(API.files)}`, {
        signal,
      });
      const body = await resp.json();

      if (body.error) {
        return { error: true, errorStr: body.error };
      }

      return { data: body.entries, error: false };
    });
  }

  static async renameEntries(map: EntryMap): Promise<APIResult<boolean>> {
    if (API.files.length !== 1) {
      return { data: true, error: false };
    }

    return abortableRequest(async (signal): Promise<APIResult<boolean>> => {
      const resp = await fetch(`/archive/entries?${fileParam(API.files)}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(map),
        signal,
      });
      const body = await resp.json();

      if (body.error) {
        return { error: true, errorStr: body.error };
      }

      return { data: body.success, error: false };
    });
  }

  static async flattenEntries(): Promise<APIResult<boolean>> {
    return abortableRequest(async (signal): Promise<APIResult<boolean>> => {
      const resp = await fetch(`/archive/flatten?${fileParam(API.files)}`, {
        method: 'POST',
        signal,
      });
      const body = await resp.json();

      if (body.error) {
        return { error: true, errorStr: body.error };
      }

      return { data: body.success, error: false };
    });
  }

  static async removeExif(): Promise<APIResult<boolean>> {
    return abortableRequest(async (signal): Promise<APIResult<boolean>> => {
      const resp = await fetch(`/archive/removeExif?${fileParam(API.files)}`, {
        method: 'POST',
        signal,
      });
      const body = await resp.json();

      if (body.error) {
        return { error: true, errorStr: body.error };
      }

      return { data: body.success, error: false };
    });
  }

  static async getMetadata(): Promise<APIResult<APIMetadata>> {
    if (API.files.length < 1) {
      return { data: {}, error: false };
    }

    return abortableRequest(async (signal): Promise<APIResult<APIMetadata>> => {
      const resp = await fetch(`/archive/metadata?${fileParam(API.files)}`, {
        signal,
      });
      const body = await resp.json();

      if (body.error) {
        return { error: true, errorStr: body.error };
      }

      return { data: body.metadata, error: false };
    });
  }

  static async setMetadata(metadata: Metadata): Promise<APIResult<boolean>> {
    if (API.files.length < 1) {
      return { error: false, data: true };
    }

    return abortableRequest(async (signal): Promise<APIResult<boolean>> => {
      const resp = await fetch(`/archive/metadata?${fileParam(API.files)}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
        signal,
      });
      const body = await resp.json();

      if (body.error) {
        return { error: true, errorStr: body.error };
      }
      return { data: true, error: false };
    });
  }

  static async setBulkMetadata(
    metadata: MetadataMap
  ): Promise<APIResult<boolean>> {
    if (API.files.length < 1) {
      return { error: false, data: true };
    }

    return abortableRequest(async (signal): Promise<APIResult<boolean>> => {
      const resp = await fetch(`/archive/metadata/bulk`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: API.files, metadata }),
        signal,
      });
      const body = await resp.json();

      if (body.error) {
        return { error: true, errorStr: body.error };
      }
      return { data: true, error: false };
    });
  }

  static getCoverUrl(): string {
    if (API.files.length > 1) {
      return '';
    }
    return `/archive/cover?${fileParam(API.files)}`;
  }

  static async setCover(entry: Entry): Promise<APIResult<boolean>> {
    return abortableRequest(async (signal): Promise<APIResult<boolean>> => {
      const resp = await fetch(`/archive/cover?${fileParam(API.files)}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entry: entry.entryName }),
        signal,
      });
      const body = await resp.json();
      if (body.error) {
        return { error: true, errorStr: body.error };
      }
      return { data: true, error: false };
    });
  }

  static async joinImages(joinList: JoinPair[]): Promise<APIResult<boolean>> {
    return abortableRequest(async (signal): Promise<APIResult<boolean>> => {
      const resp = await fetch(`/archive/image/join?${fileParam(API.files)}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(joinList),
        signal,
      });
      const body = await resp.json();
      if (body.error) {
        return { error: true, errorStr: body.error };
      }
      return { data: true, error: false };
    });
  }

  static async delete(): Promise<APIResult<boolean>> {
    return abortableRequest(async (signal): Promise<APIResult<boolean>> => {
      const resp = await fetch(`/archive/delete?${fileParam(API.files)}`, {
        method: 'POST',
        signal,
      });
      const body = await resp.json();
      if (body.error) {
        return { error: true, errorStr: body.error };
      }
      return { data: true, error: false };
    });
  }

  static async splitArchive(
    markers: SplitMarker[],
    entries: Entry[]
  ): Promise<APIResult<boolean>> {
    const splits: { filename: string; entries: string[] }[] = [];

    markers.sort((a, b) => {
      if (a.startEntry > b.startEntry) {
        return 1;
      }
      if (a.startEntry < b.startEntry) {
        return -1;
      }
      return 0;
    });

    for (const marker of markers) {
      const mapEntry = { filename: marker.filename, entries: [] as string[] };

      let inBlock = false;
      for (const entry of entries) {
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

    return abortableRequest(async (signal): Promise<APIResult<boolean>> => {
      const resp = await fetch(`/archive/split?${fileParam(API.files)}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(splits),
        signal,
      });
      const body = await resp.json();
      if (body.error) {
        return { error: true, errorStr: body.error };
      }
      return { data: true, error: false };
    });
  }
}
