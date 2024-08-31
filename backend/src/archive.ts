import { posix as path } from 'path';
import { ComicInfo } from './metadata.js';
import {
  ArchiveEntry,
  ArchiveReader,
  ArchiveWriter,
  JoinPair,
  Map,
  Split,
} from './types.js';
import mime from 'mime';
import fs from 'fs';
import { joinImages } from 'join-images';
import ExifTransformer from 'exif-be-gone';
import { Readable } from 'stream';
import { CBZReader, CBZWriter } from './cbz.js';

// Simple previous file cache, since the main use case of this server is
// single use read for a single CBZ file, this is intended to let us cache
// between calls if necessary
const fileCache = {
  filename: '',
  mtime: -1,
  reader: null as ArchiveReader | null,
};

const removeExif = (buf: Buffer): Promise<Buffer> => {
  return new Promise(async (resolve, reject) => {
    const transformer = new (ExifTransformer as any)();
    const readable = Readable.from(buf);
    const chunks: any[] = [];

    readable.pipe(transformer);
    transformer.on('data', (chunk: any) => {
      chunks.push(chunk);
    });

    transformer.on('end', async () => {
      resolve(Buffer.concat(chunks));
    });

    transformer.on('error', (err: any) => {
      reject(err);
    });
  });
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
    const readers = [CBZReader];
    const ext = path.extname(this.file);

    for (let reader of readers) {
      if (reader.extensions.includes(ext)) {
        return new reader(this.file);
      }
    }

    throw new Error(`UNSUPPORTED FILE FORMAT ${ext}`);
  }

  getWriter(): ArchiveWriter {
    const writers = [CBZWriter];
    const ext = path.extname(this.file);

    for (let writer of writers) {
      if (writer.extensions.includes(ext)) {
        return new writer();
      }
    }

    throw new Error(`UNSUPPORTED FILE FORMAT ${ext}`);
  }

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

  async entries() {
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

  async flatten() {
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

  private async getMetadataEntry() {
    if (!this.reader) return null;
    if (this.dirty) await this.reload();

    const nameRegex = new RegExp(`^ComicInfo\.xml$`, 'i');
    for (let entry of await this.reader.entries()) {
      const name = entry.filename;

      if (name.match(nameRegex)) {
        return entry;
      }
    }

    return null;
  }

  async getMetadata() {
    if (!this.reader) return new ComicInfo();
    if (this.dirty) await this.reload();

    const entry = await this.getMetadataEntry();

    if (entry !== null) {
      const data = await entry.getData();
      return ComicInfo.fromXML(data.toString());
    }

    return new ComicInfo();
  }

  async setMetadata(metadata: any) {
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

  async renameEntries(map: Map = {}) {
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

  async removeExif() {
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

  async getCover() {
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

  async setCover(coverFileName: string) {
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

  async getImageByName(targetEntry: string) {
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

  async combineImages(imagePairs: JoinPair[]) {
    if (!this.reader) return;
    if (this.dirty) await this.reload();

    const writer = this.getWriter();
    const pairMap = {} as any;
    const leftToRight = {} as any;
    const rightToLeft = {} as any;

    for (let pair of imagePairs) {
      const leftExt = path.extname(pair.leftImage);
      const rightExt = path.extname(pair.rightImage);
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
      const leftExt = path.extname(pairData.leftName);
      const rightExt = path.extname(pairData.rightName);

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

  async split(baseDir: string, splits: Split[]) {
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
      fs.writeFileSync(path.join(baseDir, split.filename), data);
    }
  }

  async reload() {
    if (!this.reader) return;

    await this.reader.close();
    this.reader = this.getReader();

    const stats = fs.statSync(this.file);
    fileCache.mtime = stats.mtimeMs;
    fileCache.reader = this.reader;
    fileCache.filename = this.file;

    this.dirty = false;
  }

  async save(data: Buffer) {
    fs.writeFileSync(this.file, data);
    this.dirty = true;
  }
}
