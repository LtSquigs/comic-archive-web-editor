import { posix as path } from 'path';
import { ComicInfo } from './metadata.js';
import { JoinPair, Map, Split } from './types.js';
import mime from 'mime';
import {
  ZipReader,
  Uint8ArrayReader,
  BlobWriter,
  BlobReader,
  ZipWriter,
  TextWriter,
  TextReader,
  Entry,
} from '@zip.js/zip.js';
import fs from 'fs';
import { joinImages } from 'join-images';

export class CBZ {
  zipReader: ZipReader<unknown>;
  file = '';

  constructor(filename: string) {
    this.file = filename;
    const file = fs.readFileSync(this.file);
    this.zipReader = new ZipReader(new Uint8ArrayReader(new Uint8Array(file)));
  }

  async close() {
    await this.zipReader.close();
  }

  async entries() {
    const entries = [];
    for (let entry of await this.zipReader.getEntries()) {
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
    const blobWriter = new BlobWriter('application/zip');
    const writer = new ZipWriter(blobWriter);

    for (let entry of await this.zipReader.getEntries()) {
      const ext = path.extname(entry.filename);
      const baseName = path.basename(entry.filename, ext);

      if (!entry.directory && entry.getData) {
        const bw = new BlobWriter();
        const data = await entry.getData(bw);
        await writer.add(baseName + ext, new BlobReader(data));
      }
    }

    await writer.close();
    const blob = await blobWriter.getData();

    this.save(blob);
  }

  private async getMetadataEntry() {
    const nameRegex = new RegExp(`^ComicInfo\.xml$`, 'i');
    for (let entry of await this.zipReader.getEntries()) {
      const name = entry.filename;

      if (name.match(nameRegex)) {
        return entry;
      }
    }

    return null;
  }

  async getMetadata() {
    const entry = await this.getMetadataEntry();

    if (entry !== null && entry.getData) {
      const str = new TextWriter();
      const data = await entry.getData(str);
      return ComicInfo.fromXML(data);
    }

    return new ComicInfo();
  }

  async setMetadata(metadata: any) {
    const info = ComicInfo.copyInto(metadata);
    const blobWriter = new BlobWriter('application/zip');
    const writer = new ZipWriter(blobWriter);
    const nameRegex = new RegExp(`^ComicInfo\.xml$`, 'i');

    for (let entry of await this.zipReader.getEntries()) {
      if (
        !entry.directory &&
        entry.getData &&
        !entry.filename.match(nameRegex)
      ) {
        const bw = new BlobWriter();
        const data = await entry.getData(bw);
        await writer.add(entry.filename, new BlobReader(data));
      }
    }

    writer.add('ComicInfo.xml', new TextReader(info.toXML()));

    await writer.close();
    const blob = await blobWriter.getData();
    this.save(blob);
  }

  async renameEntries(map: Map = {}) {
    const blobWriter = new BlobWriter('application/zip');
    const writer = new ZipWriter(blobWriter);

    for (let zipEntry of await this.zipReader.getEntries()) {
      let entryName = zipEntry.filename;
      if (map[entryName] === '') {
      } else if (map[entryName] && zipEntry.getData) {
        const bw = new BlobWriter();
        const data = await zipEntry.getData(bw);
        await writer.add(map[entryName], new BlobReader(data));
      }
    }

    await writer.close();
    const blob = await blobWriter.getData();
    this.save(blob);
  }

  removeExif() {}

  async getCover() {
    const entries = await this.zipReader.getEntries();

    let cover = null;

    for (let entry of entries.sort((a, b) =>
      a.filename.localeCompare(b.filename, undefined, { numeric: true })
    )) {
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

    const writer = new BlobWriter();
    const b = cover.getData ? await cover.getData(writer) : new Blob();
    const x = await b.arrayBuffer();

    return [Buffer.from(x), (mime as any).getType(cover.filename)];
  }

  async setCover(coverFileName: string) {
    const blobWriter = new BlobWriter('application/zip');
    const writer = new ZipWriter(blobWriter);
    let coverData: Blob | null = null;

    for (let entry of await this.zipReader.getEntries()) {
      if (!entry.directory && entry.getData) {
        const ext = path.extname(entry.filename);
        const base = path.basename(entry.filename, ext);
        if (base.match(/cover/i)) {
          continue;
        }

        const bw = new BlobWriter();
        const data = await entry.getData(bw);
        await writer.add(entry.filename, new BlobReader(data));

        if (coverFileName === entry.filename) {
          coverData = data;
        }
      }
    }

    if (coverData !== null) {
      const ext = path.extname(coverFileName);
      writer.add(`cover${ext}`, new BlobReader(coverData));
    }

    await writer.close();
    const blob = await blobWriter.getData();
    this.save(blob);
  }

  async getImageByName(targetEntry: string) {
    let foundEntry = null;
    const entries = await this.zipReader.getEntries();

    for (let entry of entries) {
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

    const writer = new BlobWriter();
    const b = foundEntry.getData
      ? await foundEntry.getData(writer)
      : new Blob();
    const x = await b.arrayBuffer();

    return [Buffer.from(x), (mime as any).getType(foundEntry.filename)];
  }

  async combineImages(imagePairs: JoinPair[]) {
    const blobWriter = new BlobWriter('application/zip');
    const writer = new ZipWriter(blobWriter);

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

    for (let entry of await this.zipReader.getEntries()) {
      if (!entry.getData) {
        continue;
      }
      const bw = new BlobWriter();

      if (leftToRight[entry.filename]) {
        const rightName = leftToRight[entry.filename];
        let leftImageData = await entry.getData(bw);
        pairMap[`${entry.filename}-${rightName}`].leftImage = leftImageData;
      } else if (rightToLeft[entry.filename]) {
        const leftName = rightToLeft[entry.filename];
        let rightImageData = await entry.getData(bw);
        pairMap[`${leftName}-${entry.filename}`].rightImage = rightImageData;
      } else if (!entry.directory) {
        const data = await entry.getData(bw);
        await writer.add(entry.filename, new BlobReader(data));
      }
    }

    for (let key in pairMap) {
      const pairData = pairMap[key];
      const leftExt = path.extname(pairData.leftName);
      const rightExt = path.extname(pairData.rightName);

      if (pairData.leftImage === null && pairData.rightImage !== null) {
        await writer.add(
          pairData.rightName,
          new BlobReader(pairData.rightImage)
        );
      } else if (pairData.leftImage !== null && pairData.rightImage === null) {
        await writer.add(pairData.leftName, new BlobReader(pairData.leftImage));
      } else if (pairData.leftImage !== null && pairData.rightImage !== null) {
        const mergedImage = await joinImages(
          [
            Buffer.from(await pairData.leftImage.arrayBuffer()),
            Buffer.from(await pairData.rightImage.arrayBuffer()),
          ],
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

        await writer.add(
          newEntryName,
          new Uint8ArrayReader(new Uint8Array(obj))
        );
      }
    }

    await writer.close();
    const blob = await blobWriter.getData();
    this.save(blob);
  }

  async split(splits: Split[]) {
    const entries = await this.zipReader.getEntries();
    const nonImages = [];
    const entryMap = {} as { [key: string]: Entry };
    const ext = path.extname(this.file);
    const basefile = path.join(
      path.dirname(this.file),
      path.basename(this.file, ext)
    );

    for (const entry of entries) {
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
      const blobWriter = new BlobWriter('application/zip');
      const writer = new ZipWriter(blobWriter);

      for (let filename of split.entries) {
        const entry = entryMap[filename];
        if (!entry || !entry.getData) continue;

        const bw = new BlobWriter();
        const data = await entry.getData(bw);
        await writer.add(entry.filename, new BlobReader(data));
      }

      if (firstSplit) {
        for (let entry of nonImages) {
          if (!entry || !entry.getData) continue;

          const bw = new BlobWriter();
          const data = await entry.getData(bw);
          await writer.add(entry.filename, new BlobReader(data));
        }
      }

      firstSplit = false;
      await writer.close();
      const blob = await blobWriter.getData();
      const data = Buffer.from(await blob.arrayBuffer());
      fs.writeFileSync([basefile, split.suffix].join(' ') + ext, data);
    }
  }

  reload() {
    this.zipReader.close();
    const file = fs.readFileSync(this.file);
    this.zipReader = new ZipReader(new Uint8ArrayReader(new Uint8Array(file)));
  }

  async save(blob: Blob) {
    const data = Buffer.from(await blob.arrayBuffer());
    fs.writeFileSync(this.file, data);

    this.reload();
  }
}
