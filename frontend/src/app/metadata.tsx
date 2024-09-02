import { useEffect, useRef, useState } from 'react';
import { ActionState } from './types';

import {
  AgeRating,
  BlackAndWhite,
  Entry,
  Manga,
  Metadata,
  APIMetadata,
} from '../shared/types';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { InfoCircledIcon, UpdateIcon } from '@radix-ui/react-icons';
import { API } from './api';
import CoverSelector from './coverSelector';
import { useToast } from '@/hooks/use-toast';

type fieldComponents =
  | {
      [Property in keyof Metadata]?: {
        type: 'number';
        help?: string;
        label?: string;
        min?: number;
        max?: number;
        step?: number;
      };
    }
  | {
      [Property in keyof Metadata]?: {
        type: 'select';
        help?: string;
        label?: string;
        enum: typeof BlackAndWhite | typeof Manga | typeof AgeRating;
      };
    }
  | {
      [Property in keyof Metadata]?: {
        help?: string;
        multiline?: boolean;
        label?: string;
      };
    };

const fields: fieldComponents = {
  title: { help: 'Title of the book.' },
  series: { help: 'Title of the series the book is part of.' },
  localizedSeries: { help: 'Localized title of the series.' },
  seriesSort: { help: 'Title to use for sorting series.' },
  number: { help: 'Number of the book in the series.' },
  count: { type: 'number', help: 'The total number of books in the series.' },
  volume: { type: 'number', help: 'Volume containing the book.' },
  alternateSeries: { help: 'Alternate series the book is part of.' },
  alternateNumber: { help: 'Number of the book in alternate series.' },
  alternateCount: {
    type: 'number',
    help: 'The total number of books in the alternate series.',
  },
  summary: { help: 'A description or summary of the book.', multiline: true },
  notes: { help: 'Free text field.', multiline: true },
  year: {
    help: 'Publication Year.',
    type: 'number',
  },
  month: {
    help: 'Publication Month.',
    type: 'number',
  },
  date: {
    help: 'Publication Date.',
    type: 'number',
  },
  writer: {
    help: 'Person or organization responsible for creating the scenario. Multiple entries can be comma separated.',
  },
  penciller: {
    help: 'Person or organization responsible for drawing the art. Multiple entries can be comma separated.',
  },
  inker: {
    help: 'Person or organization responsible for inking the pencil art. Multiple entries can be comma separated.',
  },
  colorist: {
    help: 'Person or organization responsible for applying color to drawings. Multiple entries can be comma separated.',
  },
  letterer: {
    help: 'Person or organization responsible for drawing text and speech bubbles. Multiple entries can be comma separated.',
  },
  coverArtist: {
    help: 'Person or organization responsible for drawing the cover art. Multiple entries can be comma separated.',
  },
  editor: {
    help: 'A person or organization contributing to a resource by revising or elucidating the content. Multiple entries can be comma separated.',
  },
  translator: {
    help: 'A person or organization who renders a text from one language into another. Multiple entries can be comma separated.',
  },
  publisher: {
    help: 'A person or organization responsible for publishing, releasing, or issuing a resource.',
  },
  imprint: {
    help: 'An imprint is a group of publications under the umbrella of a larger imprint or a Publisher.',
  },
  genre: {
    label: 'Genre(s)',
    help: 'Genre of the book or series. Multiple entries can be comma separated.',
  },
  tags: {
    help: 'Tags of the book or series. Multiple entries can be comma separated.',
  },
  web: {
    help: 'A URL pointing to a reference website for the book. Multiple entries can be space separated.',
  },
  pageCount: { type: 'number', help: 'The number of pages in the book.' },
  languageISO: {
    label: 'Language',
    help: 'A language code describing the language of the book.',
  },
  format: {
    help: "The original publication's binding format for scanned physical books or presentation format for digital sources.",
  },
  blackAndWhite: {
    type: 'select',
    enum: BlackAndWhite,
    help: 'Whether the book is in black and white.',
  },
  manga: {
    type: 'select',
    enum: Manga,
    help: 'Whether the book is a manga.',
  },
  characters: {
    help: 'Characters present in the book. Multiple entries can be comma separated.',
  },
  teams: {
    help: 'Teams present in the book. Multiple entries can be comma separated.',
  },
  locations: {
    help: 'Locations mentioned in the book. Multiple entries can be comma separated.',
  },
  scanInformation: {
    help: 'A free text field, usually used to store information about who scanned the book.',
    multiline: true,
  },
  storyArc: {
    help: 'The story arc that books belong to. Multiple entries can be comma separated.',
  },
  storyArcNumber: {
    help: 'The order of the book within the story arc. Multiple entries can be comma separated.',
  },
  seriesGroup: {
    help: 'A group or collection the series belongs to. Multiple entries can be comma separated',
  },
  ageRating: {
    type: 'select',
    enum: AgeRating,
    help: 'Age rating of the book.',
  },
  communityRating: {
    type: 'number',
    help: 'Community rating of the book, from 0.0 to 5.0.',
    min: 0,
    max: 5,
    step: 0.1,
  },
  mainCharacterOrTeam: {
    help: 'Main character or team mentioned in the book.',
  },
  review: {
    help: 'Review of the book.',
    multiline: true,
  },
  GTIN: {
    help: 'A Global Trade Item Number identifying the book.',
  },
};

function convertToLabel(string: string) {
  let label = string.charAt(0).toUpperCase() + string.slice(1);

  return label.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function MetadataEditor({
  metadata = {},
  files = [],
  entries = [],
}: {
  metadata: APIMetadata;
  files: string[];
  entries: Entry[];
}) {
  const [metadataStatus, setMetadataStatus] = useState(ActionState.NONE);
  const [currentMetadata, setCurrentMetadata] = useState<APIMetadata>({});
  const { toast } = useToast();
  const coverRef = useRef<any>(null);

  useEffect(() => {
    const noPages = { ...metadata };
    delete noPages.pages;
    setMetadataStatus(ActionState.NONE);
    setCurrentMetadata(noPages);
  }, [metadata]);

  const saveMetadata = async () => {
    const toDelete = [];

    for (const key in currentMetadata) {
      const obj = currentMetadata[key as keyof APIMetadata];
      if (obj && typeof obj === 'object' && 'conflict' in obj) {
        toDelete.push(key);
      }
    }

    toDelete.forEach((key) => {
      delete currentMetadata[key as keyof APIMetadata];
    });

    setMetadataStatus(ActionState.INPROGRESS);
    if (coverRef.current) coverRef.current.cancelEditing();
    const setData = await API.setMetadata(currentMetadata as Metadata);
    setMetadataStatus(ActionState.NONE);

    toast({
      title: !setData.error ? 'Task Finished' : 'Task Failed',
      variant: !setData.error ? 'default' : 'destructive',
      description: !setData.error
        ? 'Saving metadata completed.'
        : `Error occured while saving metadata: ${setData.errorStr}.`,
    });
  };

  const renderField = (name: keyof APIMetadata | '', span: number = 1) => {
    // comment for tailwind, col-span-1 col-span-2 col-span-3
    // col-span-4 col-span-5 col-span-10 col-span-11 col-span-12
    const className = `h-fit col-span-${span}`;
    if (name === '') {
      return <div className={className}></div>;
    }

    const field = fields[name];

    if (!field) {
      return null;
    }

    let value = currentMetadata[name];
    const isConflicted =
      value && typeof value === 'object' && 'conflict' in value
        ? value.conflict
        : false;

    if (isConflicted) {
      value = null;
    }

    const updateValue = (value: any) => {
      setCurrentMetadata((prevValue) => {
        const cloned = { ...prevValue };

        if ('type' in field && field.type === 'select') {
          if (value === 'REMOVE') {
            (cloned as any)[name] = null;
          } else {
            cloned[name] = value;
          }
        } else if ('type' in field && field.type === 'number') {
          if (value === '' || value === undefined || value === null) {
            (cloned as any)[name] = null;
          } else {
            const num = parseInt(value, 10);
            if (isNaN(num)) {
              (cloned as any)[name] = null;
            } else {
              cloned[name] = value;
            }
          }
        } else {
          if (value === '' || value === undefined || value === null) {
            (cloned as any)[name] = null;
          } else {
            cloned[name] = value;
          }
        }

        return cloned;
      });
    };

    if ('type' in field && field.type === 'select') {
      return (
        <div className={className}>
          <div className={'flex mb-1'}>
            <Label>{field.label ? field.label : convertToLabel(name)}</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <InfoCircledIcon className="ml-1" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{field.help}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Select value={(value as string) || ''} onValueChange={updateValue}>
            <SelectTrigger>
              <SelectValue placeholder={'Select'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={'REMOVE'}>
                <i>Remove</i>
              </SelectItem>
              {Object.keys(field.enum).map((val) => {
                const label = (field.enum as any)[val];
                return <SelectItem value={val}>{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if ('type' in field && field.type === 'number') {
      return (
        <div className={className}>
          <div className={'flex mb-1'}>
            <Label>{field.label ? field.label : convertToLabel(name)}</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <InfoCircledIcon className="ml-1" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{field.help}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            type="number"
            value={value as number}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(event) => {
              updateValue(event.target.value);
            }}
          />
        </div>
      );
    }

    if (field.multiline) {
      return (
        <div className={className}>
          <div className={'flex mb-1'}>
            <Label>{field.label ? field.label : convertToLabel(name)}</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <InfoCircledIcon className="ml-1" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{field.help}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Textarea
            value={value as string}
            onChange={(event) => {
              updateValue(event.target.value);
            }}
          />
        </div>
      );
    }

    return (
      <div className={className}>
        <div className={'flex mb-1'}>
          <Label>{field.label ? field.label : convertToLabel(name)}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <InfoCircledIcon className="ml-1" />
              </TooltipTrigger>
              <TooltipContent>
                <p>{field.help}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Input
          placeholder={isConflicted ? 'Conflicting Values' : ''}
          value={value as string}
          onChange={(event) => {
            updateValue(event.target.value);
          }}
        />
      </div>
    );
  };

  return (
    <>
      <div className="mt-4 p-4 grid grid-cols-11 gap-4 content-start">
        <div className="col-span-3 row-span-5 relative">
          <CoverSelector
            disabled={metadataStatus === ActionState.INPROGRESS}
            files={files}
            entries={entries}
            ref={coverRef}
          ></CoverSelector>
        </div>
        {renderField('title', 2)}
        {renderField('number', 1)}
        {renderField('count', 1)}
        {renderField('storyArc', 2)}
        {renderField('storyArcNumber', 2)}

        {renderField('series', 2)}
        {renderField('volume', 2)}
        {renderField('localizedSeries', 2)}
        {renderField('seriesSort', 2)}

        {renderField('writer', 2)}
        {renderField('translator', 2)}
        {renderField('inker', 2)}
        {renderField('editor', 2)}

        {renderField('year', 1)}
        {renderField('month', 1)}
        {renderField('date', 1)}
        {renderField('ageRating', 1)}
        {renderField('blackAndWhite', 2)}
        {renderField('manga', 1)}
        {renderField('languageISO', 1)}

        {renderField('genre', 2)}
        {renderField('tags', 2)}
        {renderField('format', 2)}
        {renderField('GTIN', 2)}

        {renderField('publisher', 4)}
        {renderField('imprint', 4)}
        {renderField('web', 3)}

        {renderField('summary', 11)}

        <div className="col-span-11 mt-4 mb-4">
          <Separator
            className="w-full h-0.5 mb-2"
            orientation="horizontal"
          ></Separator>
          <h4>Other Fields</h4>
        </div>

        {renderField('penciller', 2)}
        {renderField('colorist', 2)}
        {renderField('letterer', 2)}
        {renderField('coverArtist', 2)}
        {renderField('', 3)}

        {renderField('characters', 2)}
        {renderField('teams', 2)}
        {renderField('mainCharacterOrTeam', 2)}
        {renderField('locations', 2)}
        {renderField('communityRating', 2)}
        {renderField('', 1)}

        {renderField('alternateSeries', 2)}
        {renderField('alternateNumber', 2)}
        {renderField('alternateCount', 2)}
        {renderField('seriesGroup', 2)}
        {renderField('pageCount', 2)}
        {renderField('', 1)}

        {renderField('notes', 11)}

        {renderField('review', 11)}

        {renderField('scanInformation', 11)}

        <div className="col-span-11 h-[40px]"></div>

        <div className="absolute bottom-0 flex w-[calc(100%-2rem)]">
          <Button onClick={saveMetadata} className="opacity-80 w-full">
            {metadataStatus === ActionState.INPROGRESS ? (
              <UpdateIcon className="mr-1 animate-spin" />
            ) : null}{' '}
            Save Metadata
          </Button>
        </div>
      </div>
    </>
  );
}

export default MetadataEditor;
