import AdmZip from 'adm-zip';
import path from 'path';
import { ComicInfo } from './metadata';
import { Map } from './types';

export class CBZ {
  zip: AdmZip;
  file = '';

  constructor(filename: string) {
    this.file = filename;
    this.zip = new AdmZip(filename);
  }

  entries() {
    const entries = [];
    for (let entry of this.zip.getEntries()) {
      const ext = path.extname(entry.entryName);

      entries.push({
        entryName: entry.entryName,
        baseName: path.basename(entry.entryName, ext),
        extName: ext,
        isDirectory: entry.isDirectory,
      });
    }

    return entries;
  }

  flatten() {
    const directories = [];
    for (let entry of this.zip.getEntries()) {
      const ext = path.extname(entry.entryName);
      const baseName = path.basename(entry.entryName, ext);

      if (entry.isDirectory) {
        directories.push(entry);
      } else {
        entry.entryName = baseName + ext;
      }
    }

    directories.forEach((directory) => {
      this.zip.deleteFile(directory);
    });
  }

  private getMetadataEntry(): any {
    const nameRegex = new RegExp(`^ComicInfo\.xml$`, 'i');
    for (let entry of this.zip.getEntries()) {
      const name = entry.name;

      if (name.match(nameRegex)) {
        return entry;
      }
    }

    return null;
  }

  getMetadata(): ComicInfo {
    const entry = this.getMetadataEntry();

    if (entry !== null) {
      const xml = entry.getData();
      return ComicInfo.fromXML(xml);
    }

    return new ComicInfo();
  }

  setMetadata(metadata: any) {
    const info = ComicInfo.copyInto(metadata);
    const entry = this.getMetadataEntry();

    if (entry !== null) {
      this.zip.deleteFile(entry);
    }

    this.zip.addFile('ComicInfo.xml', Buffer.from(info.toXML(), 'utf8'), '');
  }

  renameEntries(map: Map = {}) {
    for (let zipEntry of this.zip.getEntries()) {
      let entryName = zipEntry.entryName;
      if (map[entryName] === '') {
        this.zip.deleteFile(zipEntry);
      } else if (map[entryName]) {
        zipEntry.entryName = map[entryName];
      }
    }
  }

  removeExif() {}

  getImages() {}

  combineImages() {}

  save() {
    this.zip.writeZip(this.file);
  }
}
