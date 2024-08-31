export type FileEntry = {
  directory: boolean;
  name: string;
  path: string;
  parentPath: string;
};

export type Entry = {
  baseName: string;
  dir: string;
  sep: string;
  entryName: string;
  extName: string;
  isDirectory: boolean;
  isImage: boolean;
  isCover: boolean;
};

export type JoinEntry = {
  leftImage: string;
  rightImage: string;
};

export type SplitMarker = {
  startEntry: string;
  endEntry: string;
  filename: string;
};

type MetadataEntry<T> = T | ConflictedMetadataEntry<T> | null;

export type APIResult<T> = {
  error: boolean;
  errorStr?: string;
  data: T;
};

type ConflictedMetadataEntry<T> = {
  conflict: true;
  values: T[];
};

export type metadataKey =
  | 'title'
  | 'series'
  | 'localizedSeries'
  | 'seriesSort'
  | 'number'
  | 'count'
  | 'volume'
  | 'alternateSeries'
  | 'alternateNumber'
  | 'alternateCount'
  | 'summary'
  | 'notes'
  | 'year'
  | 'month'
  | 'date'
  | 'writer'
  | 'penciller'
  | 'inker'
  | 'colorist'
  | 'letterer'
  | 'coverArtist'
  | 'editor'
  | 'translator'
  | 'publisher'
  | 'imprint'
  | 'genre'
  | 'tags'
  | 'web'
  | 'pageCount'
  | 'languageISO'
  | 'format'
  | 'blackAndWhite'
  | 'manga'
  | 'characters'
  | 'teams'
  | 'locations'
  | 'scanInformation'
  | 'storyArc'
  | 'storyArcNumber'
  | 'seriesGroup'
  | 'ageRating'
  | 'communityRating'
  | 'mainCharacterOrTeam'
  | 'review'
  | 'GTIN';

export type Metadata = {
  title?: MetadataEntry<string>;
  series?: MetadataEntry<string>;
  localizedSeries?: MetadataEntry<string>;
  seriesSort?: MetadataEntry<string>;
  number?: MetadataEntry<string>;
  count?: MetadataEntry<number>;
  volume?: MetadataEntry<number>;
  alternateSeries?: MetadataEntry<string>;
  alternateNumber?: MetadataEntry<string>;
  alternateCount?: MetadataEntry<number>;
  summary?: MetadataEntry<string>;
  notes?: MetadataEntry<string>;
  year?: MetadataEntry<number>;
  month?: MetadataEntry<number>;
  date?: MetadataEntry<number>;
  writer?: MetadataEntry<string>;
  penciller?: MetadataEntry<string>;
  inker?: MetadataEntry<string>;
  colorist?: MetadataEntry<string>;
  letterer?: MetadataEntry<string>;
  coverArtist?: MetadataEntry<string>;
  editor?: MetadataEntry<string>;
  translator?: MetadataEntry<string>;
  publisher?: MetadataEntry<string>;
  imprint?: MetadataEntry<string>;
  genre?: MetadataEntry<string>;
  tags?: MetadataEntry<string>;
  web?: MetadataEntry<string>;
  pageCount?: MetadataEntry<number>;
  languageISO?: MetadataEntry<string>;
  format?: MetadataEntry<string>;
  blackAndWhite?: MetadataEntry<BlackAndWhite>;
  manga?: MetadataEntry<Manga>;
  characters?: MetadataEntry<string>;
  teams?: MetadataEntry<string>;
  locations?: MetadataEntry<string>;
  scanInformation?: MetadataEntry<string>;
  storyArc?: MetadataEntry<string>;
  storyArcNumber?: MetadataEntry<string>;
  seriesGroup?: MetadataEntry<string>;
  ageRating?: MetadataEntry<AgeRating>;
  pages?: Page[];
  communityRating?: MetadataEntry<number>;
  mainCharacterOrTeam?: MetadataEntry<string>;
  review?: MetadataEntry<string>;
  GTIN?: MetadataEntry<string>;
};

export type Page = {
  image?: MetadataEntry<number>;
  type?: MetadataEntry<string>;
  doublePage?: MetadataEntry<boolean>;
  imageSize?: MetadataEntry<string>;
  key?: MetadataEntry<string>;
  bookmark?: MetadataEntry<string>;
  imageWidth?: MetadataEntry<number>;
  imageHeight?: MetadataEntry<number>;
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

export enum ActionState {
  NONE,
  INPROGRESS,
  SUCCESS,
  FAILED,
}
