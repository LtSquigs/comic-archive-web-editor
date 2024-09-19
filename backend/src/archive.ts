import { posix as path } from 'path';
import { ComicInfo } from './metadata.js';
import { ArchiveEntry, ArchiveReader, ArchiveWriter } from './types.js';
import mime from 'mime';
import fs from 'fs';
import { joinImages } from 'join-images';
import {
  hexToRgb,
  REGISTERED_READERS,
  REGISTERED_WRITERS,
  removeExif,
  resolveFiles,
  SERVER_DIR,
} from './lib.js';
import {
  Entry,
  EntryMap,
  JoinPair,
  Merge,
  MergeRequest,
  Split,
} from './shared/types.js';
import { Readable } from 'stream';
import getRawBody from 'raw-body';
import { CBZReader, CBZWriter } from './cbz.js';

// Very basic cache that just keeps the last opened CBZ read in memory
// between requests. The usual use case is to get many requests for the
// same file in sequence, optimizes for this. (Caching only applies to reader).
const fileCache = {
  filename: '',
  mtime: -1,
  reader: null as ArchiveReader | null,
};

export class Archive {
  dirty: boolean;
  reader: ArchiveReader | null;
  file = '';
  signal: AbortSignal | undefined;

  constructor(filename: string, signal?: AbortSignal) {
    this.file = filename;
    this.reader = null;
    this.dirty = false;
    this.signal = signal;
  }

  getReader(): ArchiveReader {
    const readers = REGISTERED_READERS;
    const ext = path.extname(this.file);

    for (const reader of readers) {
      if (reader.extensions.includes(ext)) {
        return new reader(this.file, this.signal);
      }
    }

    throw new Error(`UNSUPPORTED FILE FORMAT ${ext}.`);
  }

  getWriter(): ArchiveWriter {
    const writers = REGISTERED_WRITERS;
    const ext = path.extname(this.file);

    for (const writer of writers) {
      if (writer.extensions.includes(ext)) {
        return new writer(this.signal);
      }
    }

    throw new Error(`UNSUPPORTED FILE FORMAT ${ext}`);
  }

  // Loads the archive from disk or from cache if mtime has not changed
  // will handle closing the last archive if it is still open in memory.
  async load() {
    if (this.signal?.aborted) throw new Error('Request Aborted.');

    const stats = fs.statSync(this.file);
    if (
      fileCache.filename === this.file &&
      stats.mtimeMs === fileCache.mtime &&
      fileCache.reader
    ) {
      this.reader = fileCache.reader;
    } else {
      if (fileCache.reader) {
        await fileCache.reader.close();
        fileCache.filename = '';
        fileCache.mtime = -1;
      }

      this.reader = this.getReader();

      fileCache.mtime = stats.mtimeMs;
      fileCache.reader = this.reader;
      fileCache.filename = this.file;
    }
  }

  async close() {
    if (!this.reader) return;
  }

  // Retrives a list of all entries in the archive
  async entries(): Promise<Entry[]> {
    if (this.signal?.aborted) throw new Error('Request Aborted.');
    if (!this.reader) return [];
    if (this.dirty) await this.reload();

    const entries = [];
    for (const entry of await this.reader.entries()) {
      const ext = path.extname(entry.filename);
      const baseName = path.basename(entry.filename, ext);
      const dir = path.dirname(entry.filename);
      const mimeType = mime.getType(entry.filename);
      let isImage = false;
      if (mimeType && mimeType.startsWith('image/')) {
        isImage = true;
      }

      entries.push({
        entryName: entry.filename,
        baseName: baseName,
        dir: dir === '.' ? null : dir,
        extName: ext,
        isDirectory: entry.directory,
        isImage: isImage,
        isCover: !!baseName.match(/cover/i),
        sep: path.sep,
      });
    }

    return entries.sort((item1, item2) => {
      if (item1.entryName > item2.entryName) {
        return 1;
      }
      if (item1.entryName < item2.entryName) {
        return -1;
      }
      return 0;
    });
  }

  // Flattens every entry in the archive to remove directories
  async flatten(): Promise<void> {
    if (this.signal?.aborted) throw new Error('Request Aborted.');
    if (!this.reader) return;
    if (this.dirty) await this.reload();

    const writer = this.getWriter();

    for (const entry of await this.reader.entries()) {
      const ext = path.extname(entry.filename);
      const baseName = path.basename(entry.filename, ext);

      if (!entry.directory) {
        await writer.add(baseName + ext, await entry.getData());
      }
    }

    await writer.write(this.file);
    this.markDirty();
  }

  // Retrives the metadata object contained in an archive
  async getMetadata(): Promise<ComicInfo> {
    if (this.signal?.aborted) throw new Error('Request Aborted.');
    if (!this.reader) return new ComicInfo();
    if (this.dirty) await this.reload();

    const nameRegex = new RegExp(`^ComicInfo\.xml$`, 'i');
    for (const entry of await this.reader.entries()) {
      const name = entry.filename;

      if (name.match(nameRegex)) {
        const data = await entry.getData();
        return ComicInfo.fromXML(await getRawBody(data, { encoding: 'utf8' }));
      }
    }

    return new ComicInfo();
  }

  // Saves the metadata to a ComicInfo.xml entry in the archive
  // Overwrites existing ComicInfo.xml if it exists.
  async setMetadata(metadata: any): Promise<void> {
    if (this.signal?.aborted) throw new Error('Request Aborted.');
    if (!this.reader) return;
    if (this.dirty) await this.reload();

    const info = ComicInfo.copyInto(metadata);
    const writer = this.getWriter();

    const nameRegex = new RegExp(`^ComicInfo\.xml$`, 'i');
    for (const entry of await this.reader.entries()) {
      if (!entry.directory && !entry.filename.match(nameRegex)) {
        await writer.add(entry.filename, await entry.getData());
      }
    }

    writer.add(
      'ComicInfo.xml',
      Readable.from(Buffer.from(info.toXML(), 'utf-8'))
    );

    await writer.write(this.file);
    this.markDirty();
  }

  // Renames entries in the archive according to the map given
  // Map is expected to be a map of old entry names to new entry names
  async renameEntries(map: EntryMap = {}): Promise<void> {
    if (this.signal?.aborted) throw new Error('Request Aborted.');
    if (!this.reader) return;
    if (this.dirty) await this.reload();

    const writer = this.getWriter();

    for (const entry of await this.reader.entries()) {
      let entryName = entry.filename;
      if (map[entryName]) {
        await writer.add(map[entryName], await entry.getData());
      }
    }

    await writer.write(this.file);
    this.markDirty();
  }

  // Removes EXIF data from images detected in archive
  async removeExif(): Promise<void> {
    if (this.signal?.aborted) throw new Error('Request Aborted.');
    if (!this.reader) return;
    if (this.dirty) await this.reload();

    const writer = this.getWriter();

    for (const entry of await this.reader.entries()) {
      if (!entry.directory) {
        let data = await entry.getData();
        const mimeType = mime.getType(entry.filename);
        if (mimeType && mimeType.startsWith('image/')) {
          data = removeExif(data);
        }

        await writer.add(entry.filename, await Promise.resolve(data));
      }
    }

    await writer.write(this.file);
    this.markDirty();
  }

  // Retrieves the cover image from the archive if it exists.
  // Otherwise it returns the first image sorted as the cover.
  async getCover(): Promise<[Readable | null, string | null]> {
    if (this.signal?.aborted) throw new Error('Request Aborted.');
    if (!this.reader) return [null, null];
    if (this.dirty) await this.reload();

    const entries = await this.reader.entries();
    entries.sort((a, b) =>
      a.filename.localeCompare(b.filename, undefined, { numeric: true })
    );
    let cover = null;

    for (const entry of entries) {
      const mimeType = mime.getType(entry.filename);
      if (mimeType && mimeType.startsWith('image/')) {
        if (cover === null) {
          cover = entry;
          continue;
        }

        let ext = path.extname(entry.filename);
        let base = path.basename(entry.filename, ext);

        if (base.match(/cover/i)) {
          cover = entry;
        }
      }
    }

    if (!cover) {
      return [null, null];
    }

    return [await cover.getData(), mime.getType(cover.filename)];
  }

  // Copies the entry indicated by coverFileName to the the cover file
  // called cover.<jpg, png, webp, etc>
  async setCover(coverFileName: string): Promise<void> {
    if (this.signal?.aborted) throw new Error('Request Aborted.');
    if (!this.reader) return;
    if (this.dirty) await this.reload();

    const writer = this.getWriter();
    let coverData: Readable | null = null;

    for (const entry of await this.reader.entries()) {
      if (!entry.directory) {
        const ext = path.extname(entry.filename);
        const base = path.basename(entry.filename, ext);
        if (base.match(/cover/i)) {
          continue;
        }

        await writer.add(entry.filename, await entry.getData());

        if (coverFileName === entry.filename) {
          coverData = await entry.getData();
        }
      }
    }

    if (coverData !== null) {
      const ext = path.extname(coverFileName);
      writer.add(`cover${ext}`, coverData);
    }

    await writer.write(this.file);
    this.markDirty();
  }

  // Retrieves the image data of an entry file by name
  async getImageByName(
    targetEntry: string
  ): Promise<[Readable | null, string | null]> {
    if (this.signal?.aborted) throw new Error('Request Aborted.');
    if (!this.reader) return [null, null];
    if (this.dirty) await this.reload();

    let foundEntry: ArchiveEntry | null = null;

    for (const entry of await this.reader.entries()) {
      const mimeType = mime.getType(entry.filename);
      if (
        mimeType &&
        mimeType.startsWith('image/') &&
        entry.filename === targetEntry
      ) {
        foundEntry = entry;
      }
    }

    if (!foundEntry) {
      return [null, null];
    }

    return [await foundEntry.getData(), mime.getType(foundEntry.filename)];
  }

  // Combines images together in archive by the JoinPair's provided
  // Removes original images after join.
  async combineImages(
    imagePairs: JoinPair[],
    gap: number,
    gapColor: string
  ): Promise<void> {
    if (this.signal?.aborted) throw new Error('Request Aborted.');
    if (!this.reader) return;
    if (this.dirty) await this.reload();

    const writer = this.getWriter();
    const pairMap = {} as {
      [key: string]: {
        leftName: string;
        rightName: string;
        leftImage: Readable | null;
        rightImage: Readable | null;
      };
    };
    const leftToRight = {} as { [key: string]: string };
    const rightToLeft = {} as { [key: string]: string };
    const gapRGB = hexToRgb(gapColor || '#ffffff');

    for (const pair of imagePairs) {
      const leftExt = path.extname(pair.leftImage).toLowerCase();
      const rightExt = path.extname(pair.rightImage).toLowerCase();
      if (leftExt !== rightExt) {
        continue;
      }
      if (
        leftExt !== '.png' &&
        leftExt !== '.jpg' &&
        leftExt !== '.jpeg' &&
        leftExt !== '.webp' &&
        leftExt !== '.gif'
      ) {
        continue;
      }
      leftToRight[pair.leftImage] = pair.rightImage;
      rightToLeft[pair.rightImage] = pair.leftImage;
      pairMap[`${pair.leftImage}-${pair.rightImage}`] = {
        leftName: pair.leftImage,
        rightName: pair.rightImage,
        leftImage: null,
        rightImage: null,
      };
    }

    for (const entry of await this.reader.entries()) {
      if (leftToRight[entry.filename]) {
        const rightName = leftToRight[entry.filename];
        pairMap[`${entry.filename}-${rightName}`].leftImage =
          await entry.getData();
      } else if (rightToLeft[entry.filename]) {
        const leftName = rightToLeft[entry.filename];
        pairMap[`${leftName}-${entry.filename}`].rightImage =
          await entry.getData();
      } else if (!entry.directory) {
        await writer.add(entry.filename, await entry.getData());
      }
    }

    for (const key in pairMap) {
      const pairData = pairMap[key];
      const leftExt = path.extname(pairData.leftName).toLowerCase();
      const rightExt = path.extname(pairData.rightName).toLowerCase();

      if (pairData.leftImage === null && pairData.rightImage !== null) {
        await writer.add(pairData.rightName, pairData.rightImage);
      } else if (pairData.leftImage !== null && pairData.rightImage === null) {
        await writer.add(pairData.leftName, pairData.leftImage);
      } else if (pairData.leftImage !== null && pairData.rightImage !== null) {
        const mergedImage = await joinImages(
          [
            await getRawBody(pairData.leftImage),
            {
              src: await getRawBody(pairData.rightImage),
              offsetX: gap > 0 ? gap : undefined,
            },
          ],
          {
            direction: 'horizontal',
            color: { r: gapRGB?.r, g: gapRGB?.g, b: gapRGB?.b, alpha: 1 },
          }
        );
        const leftBase = path.basename(pairData.leftName, leftExt);
        const rightBase = path.basename(pairData.rightName, rightExt);
        const newEntryName = `${rightBase}-${leftBase}${leftExt}`;
        let obj = null as Buffer | null;
        if (leftExt === '.jpg' || leftExt === '.jpeg') {
          obj = await mergedImage.jpeg().toBuffer();
        } else if (leftExt === '.png') {
          obj = await mergedImage.png().toBuffer();
        } else if (leftExt === '.gif') {
          obj = await mergedImage.gif().toBuffer();
        } else if (leftExt === '.webp') {
          obj = await mergedImage.webp().toBuffer();
        }
        if (obj === null) {
          continue;
        }
        await writer.add(newEntryName, Readable.from(obj));
      }
    }

    await writer.write(this.file);
    this.markDirty();
  }

  // Splits an archive into multiple different archives based off
  // of the Split objects sent to the function. Only image files
  // are split among the archives, non image files are saved in
  // the first archive created and not others.
  async split(splits: Split[]): Promise<void> {
    if (this.signal?.aborted) throw new Error('Request Aborted.');
    if (!this.reader) return;
    if (this.dirty) await this.reload();

    const nonImages = [];
    const entryMap = {} as { [key: string]: ArchiveEntry };

    for (const entry of await this.reader.entries()) {
      if (entry.directory) {
        continue;
      }

      const mimeType = mime.getType(entry.filename);
      if (!mimeType || !mimeType.startsWith('image/')) {
        nonImages.push(entry);
      } else {
        entryMap[entry.filename] = entry;
      }
    }

    let firstSplit = true;

    for (const split of splits) {
      const writer = this.getWriter();

      for (const filename of split.entries) {
        const entry = entryMap[filename];
        if (!entry || !entry.getData) continue;

        await writer.add(entry.filename, await entry.getData());
      }

      if (firstSplit) {
        for (const entry of nonImages) {
          if (!entry || !entry.getData) continue;
          await writer.add(entry.filename, await entry.getData());
        }
      }

      firstSplit = false;

      await writer.write(path.join(SERVER_DIR, split.filename));
    }
  }

  // Reloads the CBZ file in memory from disk and clears dirty flag
  async reload(): Promise<void> {
    if (this.signal?.aborted) throw new Error('Request Aborted.');
    if (!this.reader) return;

    await this.reader.close();
    this.reader = this.getReader();

    const stats = fs.statSync(this.file);
    fileCache.mtime = stats.mtimeMs;
    fileCache.reader = this.reader;
    fileCache.filename = this.file;

    this.dirty = false;
  }

  // Saves file to disk and marks data as dirty for future reads
  async markDirty(): Promise<void> {
    this.dirty = true;
  }
}

export class Merger {
  file: string;
  merges: Merge[];
  signal?: AbortSignal;

  constructor(request: MergeRequest, signal?: AbortSignal) {
    this.file = resolveFiles([request.target])[0].resolved;
    this.merges = request.merges;
    this.signal = signal;
  }

  async merge() {
    const writer = new CBZWriter(this.signal);

    for (const merge of this.merges) {
      const file = resolveFiles([merge.file])[0];
      const reader = new CBZReader(file.resolved, this.signal);
      try {
        const entryMap: { [key: string]: ArchiveEntry } = {};

        for (const entry of await reader.entries()) {
          entryMap[entry.filename] = entry;
        }

        for (const entry of merge.entries) {
          if (entryMap[entry.old]) {
            writer.add(entry.new, await entryMap[entry.old].getData());
          }
        }
      } finally {
        await reader.close();
      }
    }

    await writer.write(this.file);
  }
}
