export type Map = {
  [key: string]: any | undefined;
};

export type JoinPair = {
  leftImage: string;
  rightImage: string;
};

export type Split = {
  suffix: string;
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
