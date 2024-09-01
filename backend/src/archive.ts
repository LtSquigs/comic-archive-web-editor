import { posix as path } from 'path';
import { ComicInfo } from './metadata.js';
import { ArchiveEntry, ArchiveReader, ArchiveWriter } from './types.js';
import mime from 'mime';
import fs from 'fs';
import { joinImages } from 'join-images';
import {
  REGISTERED_READERS,
  REGISTERED_WRITERS,
  removeExif,
  SERVER_DIR,
} from './lib.js';
import { Entry, EntryMap, JoinPair, Split } from './shared/types.js';

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

  constructor(filename: string) {
    this.file = filename;
    this.reader = null;
    this.dirty = false;
  }

  getReader(): ArchiveReader {
    const readers = REGISTERED_READERS;
    const ext = path.extname(this.file);

    for (let reader of readers) {
      if (reader.extensions.includes(ext)) {
        return new reader(this.file);
      }
    }

    throw new Error(`UNSUPPORTED FILE FORMAT ${ext}.`);
  }

  getWriter(): ArchiveWriter {
    const writers = REGISTERED_WRITERS;
    const ext = path.extname(this.file);

    for (let writer of writers) {
      if (writer.extensions.includes(ext)) {
        return new writer();
      }
    }

    throw new Error(`UNSUPPORTED FILE FORMAT ${ext}`);
  }

  // Loads the archive from disk or from cache if mtime has not changed
  // will handle closing the last archive if it is still open in memory.
  async load() {
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
    if (!this.reader) return [];
    if (this.dirty) await this.reload();

    const entries = [];
    for (let entry of await this.reader.entries()) {
      const ext = path.extname(entry.filename);
      const baseName = path.basename(entry.filename, ext);
      const dir = path.dirname(entry.filename);
      const mimeType = (mime as any).getType(entry.filename);
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
    if (!this.reader) return;
    if (this.dirty) await this.reload();

    const writer = this.getWriter();

    for (let entry of await this.reader.entries()) {
      const ext = path.extname(entry.filename);
      const baseName = path.basename(entry.filename, ext);

      if (!entry.directory) {
        await writer.add(baseName + ext, await entry.getData());
      }
    }

    this.save(await writer.write());
  }

  // Retrives the metadata object contained in an archive
  async getMetadata(): Promise<ComicInfo> {
    if (!this.reader) return new ComicInfo();
    if (this.dirty) await this.reload();

    const nameRegex = new RegExp(`^ComicInfo\.xml$`, 'i');
    for (let entry of await this.reader.entries()) {
      const name = entry.filename;

      if (name.match(nameRegex)) {
        const data = await entry.getData();
        return ComicInfo.fromXML(data.toString());
      }
    }

    return new ComicInfo();
  }

  // Saves the metadata to a ComicInfo.xml entry in the archive
  // Overwrites existing ComicInfo.xml if it exists.
  async setMetadata(metadata: any): Promise<void> {
    if (!this.reader) return;
    if (this.dirty) await this.reload();

    const info = ComicInfo.copyInto(metadata);
    const writer = this.getWriter();

    const nameRegex = new RegExp(`^ComicInfo\.xml$`, 'i');
    for (let entry of await this.reader.entries()) {
      if (!entry.directory && !entry.filename.match(nameRegex)) {
        await writer.add(entry.filename, await entry.getData());
      }
    }

    writer.add('ComicInfo.xml', Buffer.from(info.toXML(), 'utf-8'));

    this.save(await writer.write());
  }

  // Renames entries in the archive according to the map given
  // Map is expected to be a map of old entry names to new entry names
  async renameEntries(map: EntryMap = {}): Promise<void> {
    if (!this.reader) return;
    if (this.dirty) await this.reload();

    const writer = this.getWriter();

    for (let entry of await this.reader.entries()) {
      let entryName = entry.filename;
      if (map[entryName]) {
        await writer.add(map[entryName], await entry.getData());
      }
    }

    this.save(await writer.write());
  }

  // Removes EXIF data from images detected in archive
  async removeExif(): Promise<void> {
    if (!this.reader) return;
    if (this.dirty) await this.reload();

    const writer = this.getWriter();

    for (let entry of await this.reader.entries()) {
      if (!entry.directory) {
        let data = await entry.getData();
        const mimeType = (mime as any).getType(entry.filename);
        if (mimeType && mimeType.startsWith('image/')) {
          data = await removeExif(data);
        }

        await writer.add(entry.filename, data);
      }
    }

    this.save(await writer.write());
  }

  // Retrieves the cover image from the archive if it exists.
  // Otherwise it returns the first image sorted as the cover.
  async getCover(): Promise<[Buffer | null, string | null]> {
    if (!this.reader) return [null, null];
    if (this.dirty) await this.reload();

    const entries = await this.reader.entries();
    entries.sort((a, b) =>
      a.filename.localeCompare(b.filename, undefined, { numeric: true })
    );
    let cover = null;

    for (let entry of entries) {
      const mimeType = (mime as any).getType(entry.filename);
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

    return [await cover.getData(), (mime as any).getType(cover.filename)];
  }

  // Copies the entry indicated by coverFileName to the the cover file
  // called cover.<jpg, png, webp, etc>
  async setCover(coverFileName: string): Promise<void> {
    if (!this.reader) return;
    if (this.dirty) await this.reload();

    const writer = this.getWriter();
    let coverData: Buffer | null = null;

    for (let entry of await this.reader.entries()) {
      if (!entry.directory) {
        const ext = path.extname(entry.filename);
        const base = path.basename(entry.filename, ext);
        if (base.match(/cover/i)) {
          continue;
        }

        const data = await entry.getData();
        await writer.add(entry.filename, data);

        if (coverFileName === entry.filename) {
          coverData = data;
        }
      }
    }

    if (coverData !== null) {
      const ext = path.extname(coverFileName);
      writer.add(`cover${ext}`, coverData);
    }

    this.save(await writer.write());
  }

  // Retrieves the image data of an entry file by name
  async getImageByName(
    targetEntry: string
  ): Promise<[Buffer | null, string | null]> {
    if (!this.reader) return [null, null];
    if (this.dirty) await this.reload();

    let foundEntry: ArchiveEntry | null = null;

    for (let entry of await this.reader.entries()) {
      const mimeType = (mime as any).getType(entry.filename);
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

    return [
      await foundEntry.getData(),
      (mime as any).getType(foundEntry.filename),
    ];
  }

  // Combines images together in archive by the JoinPair's provided
  // Removes original images after join.
  async combineImages(imagePairs: JoinPair[]): Promise<void> {
    if (!this.reader) return;
    if (this.dirty) await this.reload();

    const writer = this.getWriter();
    const pairMap = {} as any;
    const leftToRight = {} as any;
    const rightToLeft = {} as any;

    for (let pair of imagePairs) {
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

    for (let entry of await this.reader.entries()) {
      if (leftToRight[entry.filename]) {
        const rightName = leftToRight[entry.filename];
        let leftImageData = await entry.getData();
        pairMap[`${entry.filename}-${rightName}`].leftImage = leftImageData;
      } else if (rightToLeft[entry.filename]) {
        const leftName = rightToLeft[entry.filename];
        let rightImageData = await entry.getData();
        pairMap[`${leftName}-${entry.filename}`].rightImage = rightImageData;
      } else if (!entry.directory) {
        const data = await entry.getData();
        await writer.add(entry.filename, data);
      }
    }

    for (let key in pairMap) {
      const pairData = pairMap[key];
      const leftExt = path.extname(pairData.leftName).toLowerCase();
      const rightExt = path.extname(pairData.rightName).toLowerCase();

      if (pairData.leftImage === null && pairData.rightImage !== null) {
        await writer.add(pairData.rightName, pairData.rightImage);
      } else if (pairData.leftImage !== null && pairData.rightImage === null) {
        await writer.add(pairData.leftName, pairData.leftImage);
      } else if (pairData.leftImage !== null && pairData.rightImage !== null) {
        const mergedImage = await joinImages(
          [pairData.leftImage, pairData.rightImage],
          { direction: 'horizontal' }
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

        await writer.add(newEntryName, obj);
      }
    }

    this.save(await writer.write());
  }

  // Splits an archive into multiple different archives based off
  // of the Split objects sent to the function. Only image files
  // are split among the archives, non image files are saved in
  // the first archive created and not others.
  async split(splits: Split[]): Promise<void> {
    if (!this.reader) return;
    if (this.dirty) await this.reload();

    const nonImages = [];
    const entryMap = {} as { [key: string]: ArchiveEntry };

    for (const entry of await this.reader.entries()) {
      if (entry.directory) {
        continue;
      }

      const mimeType = (mime as any).getType(entry.filename);
      if (!mimeType || !mimeType.startsWith('image/')) {
        nonImages.push(entry);
      } else {
        entryMap[entry.filename] = entry;
      }
    }

    let firstSplit = true;

    for (let split of splits) {
      const writer = this.getWriter();

      for (let filename of split.entries) {
        const entry = entryMap[filename];
        if (!entry || !entry.getData) continue;

        await writer.add(entry.filename, await entry.getData());
      }

      if (firstSplit) {
        for (let entry of nonImages) {
          if (!entry || !entry.getData) continue;
          await writer.add(entry.filename, await entry.getData());
        }
      }

      firstSplit = false;

      const data = await writer.write();
      fs.writeFileSync(path.join(SERVER_DIR, split.filename), data);
    }
  }

  // Reloads the CBZ file in memory from disk and clears dirty flag
  async reload(): Promise<void> {
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
  async save(data: Buffer): Promise<void> {
    fs.writeFileSync(this.file, data);
    this.dirty = true;
  }
}
