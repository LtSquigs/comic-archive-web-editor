export type APIKeys = {
  comicvine?: string;
  myanimelist?: string;
};

export type Entry = {
  baseName: string;
  dir: string | null;
  sep: string;
  entryName: string;
  extName: string;
  isDirectory: boolean;
  isImage: boolean;
  isCover: boolean;
};

export type EntryMap = {
  [key: string]: string;
};

export type MergeRequest = {
  target: string;
  merges: Merge[];
};

export type Merge = {
  file: string;
  entries: {
    old: string;
    new: string;
  }[];
};

export type JoinPair = {
  leftImage: string;
  rightImage: string;
};

export type Split = {
  filename: string;
  entries: string[];
};

export enum BlackAndWhite {
  UNKNOWN = 'Unknown',
  NO = 'No',
  YES = 'Yes',
}

export enum Manga {
  UNKNOWN = 'Unknown',
  NO = 'No',
  YES = 'Yes',
  YES_RTL = 'YesAndRightToLeft',
}

export enum AgeRating {
  UNKNOWN = 'Unknown',
  ADULTS_ONLY = 'Adults Only 18+',
  EARLY_CHILDHOOD = 'Early Childhood',
  EVERYONE = 'Everyone',
  EVERYONE_10 = 'Everyone 10+',
  G = 'G',
  KIDS_TO_ADULTS = 'Kids to Adults',
  M = 'M',
  MA15 = 'MA15+',
  MA17 = 'Mature 17+',
  PG = 'PG',
  R18 = 'R18+',
  RATING_PENDING = 'Rating Pending',
  TEEN = 'Teen',
  X18 = 'X18+',
}

export enum PageType {
  FRONT_COVER = 'FrontCover',
  INNER_COVER = 'InnerCover',
  ROUNDUP = 'Roundup',
  STORY = 'Story',
  ADVERTISEMENT = 'Advertisement',
  EDITORIAL = 'Editorial',
  LETTERS = 'Letters',
  PREVIEW = 'Preview',
  BACK_COVER = 'BackCover',
  OTHER = 'Other',
  DELETED = 'Deleted',
}

type MetadataEntry<T> = T | ConflictedMetadataEntry<T> | null;

export type ConflictedMetadataEntry<T> = {
  conflict: true;
  values: T[];
};

export type BaseMetadata = {
  title: string;
  series: string;
  localizedSeries: string;
  seriesSort: string;
  number: string;
  count: number;
  volume: number;
  alternateSeries: string;
  alternateNumber: string;
  alternateCount: number;
  summary: string;
  notes: string;
  year: number;
  month: number;
  date: number;
  writer: string;
  penciller: string;
  inker: string;
  colorist: string;
  letterer: string;
  coverArtist: string;
  editor: string;
  translator: string;
  publisher: string;
  imprint: string;
  genre: string;
  tags: string;
  web: string;
  pageCount: number;
  languageISO: string;
  format: string;
  blackAndWhite: BlackAndWhite;
  manga: Manga;
  characters: string;
  teams: string;
  locations: string;
  scanInformation: string;
  storyArc: string;
  storyArcNumber: string;
  seriesGroup: string;
  ageRating: AgeRating;
  communityRating: number;
  mainCharacterOrTeam: string;
  review: string;
  GTIN: string;
};

export type BasePage = {
  image: number;
  type: string;
  doublePage: boolean;
  imageSize: string;
  key: string;
  bookmark: string;
  imageWidth: number;
  imageHeight: number;
};

export type MetadataMap = {
  [key: string]: Metadata;
};

export type Metadata = {
  [Property in keyof BaseMetadata]: BaseMetadata[Property] | null;
} & {
  pages: Page[];
};

export type Page = {
  [Property in keyof BasePage]: BasePage[Property] | null;
};

export type APIMetadata = {
  [Property in keyof BaseMetadata]?: MetadataEntry<BaseMetadata[Property]>;
} & {
  pages?: APIPage[];
};

export type APIPage = {
  [Property in keyof BasePage]?: MetadataEntry<BasePage[Property]>;
};
