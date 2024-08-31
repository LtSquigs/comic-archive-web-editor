import { useEffect, useState } from 'react';
import { ActionState, Metadata, metadataKey } from './types';

import { Button } from '@/components/ui/button';
import { UpdateIcon } from '@radix-ui/react-icons';
import { API } from './api';
import { Textarea } from '@/components/ui/textarea';
import Papa from 'papaparse';
import { useToast } from '@/hooks/use-toast';

const validKeys = {
  title: /title/i,
  series: /series/i,
  localizedSeries: /localizedSeries/i,
  seriesSort: /seriesSort/i,
  number: /number/i,
  count: /count/i,
  volume: /volume/i,
  alternateSeries: /alternateSeries/i,
  alternateNumber: /alternateNumber/i,
  alternateCount: /alternateCount/i,
  summary: /summary/i,
  notes: /notes/i,
  year: /year/i,
  month: /month/i,
  date: /date/i,
  writer: /writer/i,
  penciller: /penciller/i,
  inker: /inker/i,
  colorist: /colorist/i,
  letterer: /letterer/i,
  coverArtist: /coverArtist/i,
  editor: /editor/i,
  translator: /translator/i,
  publisher: /publisher/i,
  imprint: /imprint/i,
  genre: /genre/i,
  tags: /tags/i,
  web: /web/i,
  pageCount: /pageCount/i,
  languageISO: /languageISO/i,
  format: /format/i,
  blackAndWhite: /blackAndWhite/i,
  manga: /manga/i,
  characters: /characters/i,
  teams: /teams/i,
  locations: /locations/i,
  scanInformation: /scanInformation/i,
  storyArc: /storyArc/i,
  storyArcNumber: /storyArcNumber/i,
  seriesGroup: /selectGroups/i,
  ageRating: /ageRating/i,
  communityRating: /communityRating/i,
  mainCharacterOrTeam: /mainCharacterOrTeam/i,
  review: /review/i,
  GTIN: /GTIN/i,
};

const BlackAndWhiteReverse = {
  Unknown: 'UNKNOWN',
  No: 'NO',
  Yes: 'YES',
} as any;

const MangaReverse = {
  Unknown: 'UNKNOWN',
  No: 'NO',
  Yes: 'YES',
  YesAndRightToLeft: 'YES_RTL',
} as any;

const AgeRatingReverse = {
  Unknown: 'UNKNOWN',
  'Adults Only 18+': 'ADULTS_ONLY',
  'Early Childhood': 'EARLY_CHILDHOOD',
  Everyone: 'EVERYONE',
  'Everyone 10+': 'EVERYONE_10',
  G: 'G',
  'Kids to Adults': 'KIDS_TO_ADULTS',
  M: 'M',
  'MA15+': 'MA15',
  'Mature 17+': 'MA17',
  PG: 'PG',
  'R18+': 'R18',
  'Rating Pending': 'RATING_PENDING',
  Teen: 'TEEN',
  'X18+': 'X18',
} as any;

const PageTypeReverse = {
  FrontCover: 'FRONT_COVER',
  InnerCover: 'INNER_COVER',
  Roundup: 'ROUNDUP',
  Story: 'STORY',
  Advertisement: 'ADVERTISEMENT',
  Editorial: 'EDITORIAL',
  Letters: 'LETTERS',
  Preview: 'PREVIEW',
  BackCover: 'BACK_COVER',
  Other: 'OTHER',
  Deleted: 'DELETED',
} as any;

export function BulkMetadata({ files }: { files: string[] }) {
  const [bulkStatus, setBulkStatus] = useState(ActionState.NONE);
  const [csvString, setCSVString] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    setBulkStatus(ActionState.NONE);
  }, [files]);

  const uploadMetadata = async () => {
    setBulkStatus(ActionState.INPROGRESS);

    const result = Papa.parse<Metadata>(csvString, {
      header: true,
      dynamicTyping: true,
    });
    const data = result.data;

    if (data.length != files.length) {
      setBulkStatus(ActionState.NONE);
      toast({
        title: 'Task Failed',
        variant: 'destructive',
        description: `The number of CSV rows provided does not match the number of selected files.`,
      });
      return;
    }

    const fieldMap = {} as { [key: string]: string };

    for (let field of result.meta.fields || []) {
      let foundKey = false;
      for (let key in validKeys) {
        const regex = (validKeys as any)[key];
        if (field.match(regex)) {
          foundKey = true;
          fieldMap[field] = key;
          break;
        }
      }
      // Camelcase converter here
      if (!foundKey) {
        setBulkStatus(ActionState.NONE);
        toast({
          title: 'Task Failed',
          variant: 'destructive',
          description: `This CSV contains invalid field "${field}" for the ComicInfo schema.`,
        });
        return;
      }
    }

    const orderedFiles = [...files];
    orderedFiles.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );

    const metadataMap = {} as { [key: string]: Metadata };
    for (let i = 0; i < data.length; i++) {
      const parsed = data[i];
      const file = orderedFiles[i];

      for (let key in parsed) {
        const mappedKey = fieldMap[key];
        if (key !== mappedKey) {
          (parsed as any)[mappedKey] = parsed[key as metadataKey];
          delete parsed[key as metadataKey];
        }
        if (
          parsed[mappedKey as metadataKey] === '' ||
          parsed[mappedKey as metadataKey] === undefined ||
          parsed[mappedKey as metadataKey] === null
        ) {
          parsed[mappedKey as metadataKey] = null;
        }
      }

      if (parsed.blackAndWhite) {
        if (BlackAndWhiteReverse[parsed.blackAndWhite as any]) {
          parsed.blackAndWhite =
            BlackAndWhiteReverse[parsed.blackAndWhite as any];
        }
      }

      if (parsed.manga) {
        if (MangaReverse[parsed.manga as any]) {
          parsed.manga = MangaReverse[parsed.manga as any];
        }
      }

      if (parsed.ageRating) {
        if (AgeRatingReverse[parsed.ageRating as any]) {
          parsed.ageRating = AgeRatingReverse[parsed.ageRating as any];
        }
      }

      metadataMap[file] = parsed;
    }

    setBulkStatus(ActionState.INPROGRESS);
    const {
      data: success,
      error,
      errorStr,
    } = await API.setBulkMetadata(metadataMap);
    setBulkStatus(ActionState.NONE);

    toast({
      title: success && !error ? 'Task Finished' : 'Task Failed',
      variant: success && !error ? 'default' : 'destructive',
      description:
        success && !error
          ? 'Bulk application of metadata completed.'
          : `An error occured while applying metadata: ${errorStr}.`,
    });
  };

  return (
    <div
      className="flex flex-col gap-2"
      style={{ height: 'calc(100% - 40px)' }}
    >
      <h6 className="text-xl font-semibold mb-2">Bulk Metadata CSV Upload</h6>
      <p className="text-sm text-muted-foreground">
        This is expected to be a CSV formatted set of data where the first row
        is a header where the column names match the fields from the ComicInfo
        format.{' '}
      </p>
      <p className="text-sm text-muted-foreground">
        Each row will be applied to the selected files in sort order (first row
        = first file, last row = last file), the number of rows must match the
        number of selected files.
      </p>
      <p className="text-sm text-muted-foreground">
        Fields not present in the data will not be modified, fields present but
        empty will be cleared.
      </p>
      <p className="text-sm text-muted-foreground">
        Page Metadata is not supported via this tool.
      </p>
      <Textarea
        className="flex-grow"
        value={csvString}
        onChange={(event) => {
          setCSVString(event.target.value);
        }}
      ></Textarea>
      <Button className="width-full" onClick={uploadMetadata}>
        {bulkStatus === ActionState.INPROGRESS ? (
          <UpdateIcon className="mr-1 animate-spin" />
        ) : null}{' '}
        Upload Metadata
      </Button>
    </div>
  );
}

export default BulkMetadata;
