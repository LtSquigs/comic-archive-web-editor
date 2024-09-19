import {
  AgeRating,
  BaseMetadata,
  BlackAndWhite,
  Entry,
  Manga,
} from '../shared/types';

type OnlyKeysWithType<Map, TypeToFind, Key = keyof Map> = Key extends keyof Map
  ? Map[Key] extends TypeToFind
    ? Key
    : never
  : never;

type InputComponent = {
  type?: never;
  help: string;
  multiline?: boolean;
  label: string;
};
type SelectComponent = {
  type: 'select';
  help: string;
  label: string;
  enum: typeof BlackAndWhite | typeof Manga | typeof AgeRating;
};

type NumberComponent = {
  type: 'number';
  help: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
};

export type MetadataFieldComponent =
  | InputComponent
  | SelectComponent
  | NumberComponent;

type metadataFieldComponentMap =
  | {
      [Property in OnlyKeysWithType<BaseMetadata, number>]: NumberComponent;
    }
  | {
      [Property in OnlyKeysWithType<
        BaseMetadata,
        BlackAndWhite | Manga | AgeRating
      >]: SelectComponent;
    }
  | {
      [Property in OnlyKeysWithType<BaseMetadata, string>]: InputComponent;
    };

export const MetadataFields = {
  title: { label: 'Title', help: 'Title of the book.' },
  series: { label: 'Series', help: 'Title of the series the book is part of.' },
  localizedSeries: {
    label: 'Localized Series',
    help: 'Localized title of the series.',
  },
  seriesSort: {
    label: 'Series Sort',
    help: 'Title to use for sorting series.',
  },
  number: { label: 'Number', help: 'Number of the book in the series.' },
  count: {
    label: 'Count',
    type: 'number',
    help: 'The total number of books in the series.',
  },
  volume: {
    label: 'Volume',
    type: 'number',
    help: 'Volume containing the book.',
  },
  alternateSeries: {
    label: 'Alternate Series',
    help: 'Alternate series the book is part of.',
  },
  alternateNumber: {
    label: 'Alternate Number',
    help: 'Number of the book in alternate series.',
  },
  alternateCount: {
    label: 'Alternate Count',
    type: 'number',
    help: 'The total number of books in the alternate series.',
  },
  summary: {
    label: 'Summary',
    help: 'A description or summary of the book.',
    multiline: true,
  },
  notes: { label: 'Notes', help: 'Free text field.', multiline: true },
  year: { label: 'Year', help: 'Publication Year.', type: 'number' },
  month: { label: 'Month', help: 'Publication Month.', type: 'number' },
  date: { label: 'Date', help: 'Publication Date.', type: 'number' },
  writer: {
    label: 'Writer',
    help: 'Person or organization responsible for creating the scenario. Multiple entries can be comma separated.',
  },
  penciller: {
    label: 'Penciller',
    help: 'Person or organization responsible for drawing the art. Multiple entries can be comma separated.',
  },
  inker: {
    label: 'Inker',
    help: 'Person or organization responsible for inking the pencil art. Multiple entries can be comma separated.',
  },
  colorist: {
    label: 'Colorist',
    help: 'Person or organization responsible for applying color to drawings. Multiple entries can be comma separated.',
  },
  letterer: {
    label: 'Letterer',
    help: 'Person or organization responsible for drawing text and speech bubbles. Multiple entries can be comma separated.',
  },
  coverArtist: {
    label: 'Cover Artist',
    help: 'Person or organization responsible for drawing the cover art. Multiple entries can be comma separated.',
  },
  editor: {
    label: 'Editor',
    help: 'A person or organization contributing to a resource by revising or elucidating the content. Multiple entries can be comma separated.',
  },
  translator: {
    label: 'Translator',
    help: 'A person or organization who renders a text from one language into another. Multiple entries can be comma separated.',
  },
  publisher: {
    label: 'Publisher',
    help: 'A person or organization responsible for publishing, releasing, or issuing a resource.',
  },
  imprint: {
    label: 'Imprint',
    help: 'An imprint is a group of publications under the umbrella of a larger imprint or a Publisher.',
  },
  genre: {
    label: 'Genre(s)',
    help: 'Genre of the book or series. Multiple entries can be comma separated.',
  },
  tags: {
    label: 'Tags',
    help: 'Tags of the book or series. Multiple entries can be comma separated.',
  },
  web: {
    label: 'Web',
    help: 'A URL pointing to a reference website for the book. Multiple entries can be space separated.',
  },
  pageCount: {
    label: 'Page Count',
    type: 'number',
    help: 'The number of pages in the book.',
  },
  languageISO: {
    label: 'Language',
    help: 'A language code describing the language of the book.',
  },
  format: {
    label: 'Format',
    help: "The original publication's binding format for scanned physical books or presentation format for digital sources.",
  },
  blackAndWhite: {
    label: 'Black And White',
    type: 'select',
    enum: BlackAndWhite,
    help: 'Whether the book is in black and white.',
  },
  manga: {
    label: 'Manga',
    type: 'select',
    enum: Manga,
    help: 'Whether the book is a manga.',
  },
  characters: {
    label: 'Characters',
    help: 'Characters present in the book. Multiple entries can be comma separated.',
  },
  teams: {
    label: 'Teams',
    help: 'Teams present in the book. Multiple entries can be comma separated.',
  },
  locations: {
    label: 'Locations',
    help: 'Locations mentioned in the book. Multiple entries can be comma separated.',
  },
  scanInformation: {
    label: 'Scan Information',
    help: 'A free text field, usually used to store information about who scanned the book.',
    multiline: true,
  },
  storyArc: {
    label: 'Story Arc',
    help: 'The story arc that books belong to. Multiple entries can be comma separated.',
  },
  storyArcNumber: {
    label: 'Story Arc Number',
    help: 'The order of the book within the story arc. Multiple entries can be comma separated.',
  },
  seriesGroup: {
    label: 'Series Group',
    help: 'A group or collection the series belongs to. Multiple entries can be comma separated',
  },
  ageRating: {
    label: 'Age Rating',
    type: 'select',
    enum: AgeRating,
    help: 'Age rating of the book.',
  },
  communityRating: {
    label: 'Community Rating',
    type: 'number',
    help: 'Community rating of the book, from 0.0 to 5.0.',
    min: 0,
    max: 5,
    step: 0.1,
  },
  mainCharacterOrTeam: {
    label: 'Main Character Or Team',
    help: 'Main character or team mentioned in the book.',
  },
  review: { label: 'Review', help: 'Review of the book.', multiline: true },
  GTIN: {
    label: 'GTIN',
    help: 'A Global Trade Item Number identifying the book.',
  },
} satisfies metadataFieldComponentMap;

export const changeImageNum = (entry: Entry, change: number) => {
  const numRange = entry.baseName.match(/(\d+)-(\d+)$/);
  if (numRange) {
    const padLen = numRange[1].length;
    const firstNum = parseInt(numRange[1]);
    const secondNum = parseInt(numRange[2]);
    const newFirst = (firstNum - change).toString().padStart(padLen, '0');
    const newSecond = (secondNum - change).toString().padStart(padLen, '0');
    const newBaseName = entry.baseName.replace(
      /(\d+)-(\d+)$/,
      `${newFirst}-${newSecond}`
    );

    return `${newBaseName}${entry.extName}`;
  }

  const singleNumber = entry.baseName.match(/(\d+)$/);
  if (singleNumber) {
    const padLen = singleNumber[1].length;
    const num = parseInt(singleNumber[1]);
    const newNum = (num - change).toString().padStart(padLen, '0');
    const newBaseName = entry.baseName.replace(/(\d+)$/, `${newNum}`);
    return `${newBaseName}${entry.extName}`;
  }

  return entry.entryName;
};

export const getEntryNumber = (
  name: string
): { prefix: string; number: number | null; secondNumber: number | null } => {
  let parts = name.match(/^([\d\.]+)-([\d\.]+)$/);
  if (parts) {
    return {
      prefix: '',
      number: parseFloat(parts[1]),
      secondNumber: parseFloat(parts[2]),
    };
  }
  // todo match range
  if (name.match(/^[\d\.]+$/)) {
    return { prefix: '', number: parseFloat(name), secondNumber: null };
  }

  parts = name.match(/([\d\.]+)-([\d\.]+)$/);
  if (parts) {
    return {
      prefix: name.replace(/([\d\.]+)-([\d\.]+)$/, ''),
      number: parseFloat(parts[1]),
      secondNumber: parseFloat(parts[2]),
    };
  }

  parts = name.match(/([\d\.])+$/);
  if (parts) {
    return {
      prefix: name.replace(/[\d\.]+$/, ''),
      number: parseFloat(parts[1]),
      secondNumber: null,
    };
  }

  return { prefix: name, number: null, secondNumber: null };
};

export const range = (a: number, b: number) => {
  const rangeArr = [];
  if (a > b) {
    for (let x = b; x <= a; x++) {
      rangeArr.push(x);
    }

    return rangeArr;
  }

  for (let x = a; x <= b; x++) {
    rangeArr.push(x);
  }

  return rangeArr;
};
