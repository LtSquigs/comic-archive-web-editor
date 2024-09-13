import { FileEntry, SplitMarker, APIResult } from './types';

import {
  Entry,
  APIMetadata,
  Metadata,
  MetadataMap,
  JoinPair,
  EntryMap,
  APIKeys,
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
    if (error.name === 'AbortError') {
      return { error: true, aborted: true, errorStr: error.message };
    }
    return { error: true, errorStr: error.message };
  } finally {
    abortController = null;
  }
};

export class API {
  static files: string[] = [];

  static setFiles(files: string[]) {
    API.files = files;
  }

  static async getArchiveFiles(
    subdir: string = ''
  ): Promise<APIResult<FileEntry[]>> {
    return abortableRequest(async (signal): Promise<APIResult<FileEntry[]>> => {
      const params = new URLSearchParams();
      params.append('prefix', subdir);

      const resp = await fetch(`/archive/list?${params.toString()}`, {
        signal,
      });
      const body = await resp.json();

      if (body.error) {
        return { error: true, errorStr: body.error };
      }

      return { data: body.paths, error: false };
    });
  }

  static async getKeys(): Promise<APIResult<APIKeys>> {
    const resp = await fetch(`/keys`);
    const body = await resp.json();

    if (body.error) {
      return { error: true, errorStr: body.error };
    }

    return { data: body.keys, error: false };
  }

  static async setKeys(keys: APIKeys): Promise<APIResult<boolean>> {
    return abortableRequest(async (signal): Promise<APIResult<boolean>> => {
      const resp = await fetch(`/keys`, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keys }),
        signal,
      });
      const body = await resp.json();

      if (body.error) {
        return { error: true, errorStr: body.error };
      }

      return { data: body.success, error: false };
    });
  }

  static async getEntries(): Promise<APIResult<Entry[]>> {
    if (API.files.length !== 1) {
      return { data: [], error: false };
    }

    return abortableRequest(async (signal): Promise<APIResult<Entry[]>> => {
      const resp = await fetch(`/archive/entries`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: API.files }),
        signal,
      });
      const body = await resp.json();

      if (body.error) {
        return { error: true, errorStr: body.error };
      }

      const entries = body.entries;

      entries.sort((a: Entry, b: Entry) =>
        a.entryName.localeCompare(b.entryName, undefined, { numeric: true })
      );

      return { data: body.entries, error: false };
    });
  }

  static async renameEntries(map: EntryMap): Promise<APIResult<boolean>> {
    if (API.files.length !== 1) {
      return { data: true, error: false };
    }

    return abortableRequest(async (signal): Promise<APIResult<boolean>> => {
      const resp = await fetch(`/archive/entries`, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: API.files, map }),
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
      const resp = await fetch(`/archive/flatten`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: API.files }),
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
      const resp = await fetch(`/archive/removeExif`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: API.files }),
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
      const resp = await fetch(`/archive/metadata`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: API.files }),
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
      const resp = await fetch(`/archive/metadata`, {
        method: 'PUT',
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

    const params = new URLSearchParams();
    for (const file of API.files) {
      params.append('files', file);
    }

    return `/archive/cover?${params.toString()}`;
  }

  static getImageUrl(
    file: string,
    entry: string,
    cacheBuster?: string
  ): string {
    const params = new URLSearchParams();
    params.append('files', file);
    params.append('entry', entry);
    if (cacheBuster) {
      params.append('cacheBust', cacheBuster);
    }
    return `/archive/image?${params.toString()}`;
  }

  static async setCover(entry: Entry): Promise<APIResult<boolean>> {
    return abortableRequest(async (signal): Promise<APIResult<boolean>> => {
      const resp = await fetch(`/archive/cover`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: API.files, entry: entry.entryName }),
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
      const resp = await fetch(`/archive/image/join`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: API.files, joinList: joinList }),
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
      const resp = await fetch(`/archive/delete`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: API.files }),
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
      const resp = await fetch(`/archive/split`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: API.files, splits }),
        signal,
      });
      const body = await resp.json();
      if (body.error) {
        return { error: true, errorStr: body.error };
      }
      return { data: true, error: false };
    });
  }

  static async scrape(url: string): Promise<APIResult<APIMetadata>> {
    return abortableRequest(async (signal): Promise<APIResult<APIMetadata>> => {
      const resp = await fetch(`/scrape`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url }),
        signal,
      });
      const body = await resp.json();

      if (body.error) {
        return { error: true, errorStr: body.error };
      }

      return { data: body.metadata, error: false };
    });
  }
}
