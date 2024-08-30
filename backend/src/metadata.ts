import convert from 'xml-js-graphite';
import { AgeRating, BlackAndWhite, Manga, Map } from './types.js';

const find = (xmlEle: any, name: string): any => {
  return ((xmlEle || {}).elements || []).find((ele: any) => {
    const regex = new RegExp(`^${name}$`, 'i');
    return ele.name.match(regex);
  });
};

const text = (xmlEle: any): any => {
  const textEle = ((xmlEle || {}).elements || []).find((ele: any) => {
    return ele.type == 'text';
  });

  return textEle?.text;
};

export class Page {
  image: number | null = null;
  type: string | null = null;
  doublePage: boolean | null = null;
  imageSize: string | null = null;
  key: string | null = null;
  bookmark: string | null = null;
  imageWidth: number | null = null;
  imageHeight: number | null = null;

  static fromXJS(xmlTree: any): Page {
    const p = new Page();

    const attributes = (xmlTree || {}).attributes || {};
    for (const property in p) {
      const upperName = property.charAt(0).toUpperCase() + property.slice(1);

      const value = attributes[upperName];
      if (value !== undefined) {
        (p as Map)[property] = value;
      }
    }

    return p;
  }

  toXJS(): any {
    const attributes: Map = {};

    for (const property in this) {
      const value = this[property];

      if (value !== null) {
        const upperName = property.charAt(0).toUpperCase() + property.slice(1);
        attributes[upperName] = value;
      }
    }

    let xmlTree = {
      type: 'element',
      name: 'Page',
      attributes: attributes,
    };

    return xmlTree;
  }

  static copyInto(obj: any): Page {
    const p = new Page();

    const pProps = Object.getOwnPropertyNames(p);
    for (const property in obj) {
      if (pProps.indexOf(property) === -1) {
        continue;
      }

      (p as Map)[property] = obj[property];
    }

    return p;
  }

  copyOut(): any {
    const obj: Map = {};
    for (const property in this) {
      const value = this[property];

      // if (value === null) {
      //   continue;
      // }

      obj[property as string] = value;
    }

    return obj;
  }
}

export class ComicInfo implements Map {
  title: string | null = null;
  series: string | null = null;
  localizedSeries: string | null = null;
  seriesSort: string | null = null;
  number: string | null = null;
  count: number | null = null;
  volume: number | null = null;
  alternateSeries: string | null = null;
  alternateNumber: string | null = null;
  alternateCount: number | null = null;
  summary: string | null = null;
  notes: string | null = null;
  year: number | null = null;
  month: number | null = null;
  date: number | null = null;
  writer: string | null = null;
  penciller: string | null = null;
  inker: string | null = null;
  colorist: string | null = null;
  letterer: string | null = null;
  coverArtist: string | null = null;
  editor: string | null = null;
  translator: string | null = null;
  publisher: string | null = null;
  imprint: string | null = null;
  genre: string | null = null;
  tags: string | null = null;
  web: string | null = null;
  pageCount: number | null = null;
  languageISO: string | null = null;
  format: string | null = null;
  blackAndWhite: BlackAndWhite | null = null;
  manga: Manga | null = null;
  characters: string | null = null;
  teams: string | null = null;
  locations: string | null = null;
  scanInformation: string | null = null;
  storyArc: string | null = null;
  storyArcNumber: string | null = null;
  seriesGroup: string | null = null;
  ageRating: AgeRating | null = null;
  pages: Page[] = [];
  communityRating: number | null = null;
  mainCharacterOrTeam: string | null = null;
  review: string | null = null;
  GTIN: string | null = null;

  static fromXML(xmlData: string): ComicInfo {
    let xmlTree = convert.xml2js(xmlData, {
      trim: true,
      nativeType: true,
      // @ts-ignore
      nativeTypeAttributes: true,
    });

    return this.fromXJS(xmlTree);
  }

  static fromXJS(xmlTree: any): ComicInfo {
    const ci = new ComicInfo();

    const topEle = find(xmlTree, 'ComicInfo');
    for (const property in ci) {
      if (property === 'pages') {
        continue;
      }
      const value = text(find(topEle, property));
      if (value !== undefined) {
        (ci as Map)[property] = value;
      }
    }

    ci.pages = ((find(topEle, 'Pages') || {}).elements || []).map(
      (ele: any): Page => {
        return Page.fromXJS(ele);
      }
    );

    return ci;
  }

  toXML(): string {
    return convert.js2xml(this.toXJS(), { spaces: 2 });
  }

  toXJS(): any {
    const elements = [];
    for (const property in this) {
      const value = this[property];

      if (value !== null) {
        const upperName = property.charAt(0).toUpperCase() + property.slice(1);

        if (Array.isArray(value) && value.length <= 0) {
          continue;
        }

        if (property === 'pages') {
          const pages = (value as Page[]).map((page) => {
            return page.toXJS();
          });

          elements.push({
            type: 'element',
            name: upperName,
            elements: pages,
          });

          continue;
        }

        elements.push({
          type: 'element',
          name: upperName,
          elements: [{ type: 'text', text: value }],
        });
      }
    }

    let xmlTree = {
      declaration: {
        attributes: {
          version: '1.0',
          encoding: 'utf-8',
        },
      },
      elements: [{ type: 'element', name: 'ComicInfo', elements: elements }],
    };

    return xmlTree;
  }

  static copyInto(obj: any): ComicInfo {
    const ci = new ComicInfo();

    const ciProps = Object.getOwnPropertyNames(ci);
    for (const property in obj) {
      if (ciProps.indexOf(property) === -1) {
        continue;
      }

      if (property === 'pages') {
        ci.pages = (obj[property] || []).map((page: any) => {
          return Page.copyInto(page);
        });

        continue;
      }
      (ci as Map)[property] = obj[property];
    }

    return ci;
  }

  copyOut(exclude: string[] = []): any {
    const obj: Map = {};
    for (const property in this) {
      const value = this[property];

      if (exclude.indexOf(property) !== -1) {
        continue;
      }

      if (property === 'pages') {
        obj[property as string] = (value as Page[]).map((item) => {
          return item.copyOut();
        });
        continue;
      }
      obj[property as string] = value;
    }

    return obj;
  }
}
