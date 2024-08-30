import { useEffect, useState } from 'react';
import { ActionState, Metadata, metadataKey } from './types';

import { Button } from '@/components/ui/button';
import { UpdateIcon } from '@radix-ui/react-icons';
import { API } from './api';
import { Textarea } from '@/components/ui/textarea';
import Papa from 'papaparse';

const validKeys = {
  title: true,
  series: true,
  localizedSeries: true,
  seriesSort: true,
  number: true,
  count: true,
  volume: true,
  alternateSeries: true,
  alternateNumber: true,
  alternateCount: true,
  summary: true,
  notes: true,
  year: true,
  month: true,
  date: true,
  writer: true,
  penciller: true,
  inker: true,
  colorist: true,
  letterer: true,
  coverArtist: true,
  editor: true,
  translator: true,
  publisher: true,
  imprint: true,
  genre: true,
  tags: true,
  web: true,
  pageCount: true,
  languageISO: true,
  format: true,
  blackAndWhite: true,
  manga: true,
  characters: true,
  teams: true,
  locations: true,
  scanInformation: true,
  storyArc: true,
  storyArcNumber: true,
  seriesGroup: true,
  ageRating: true,
  communityRating: true,
  mainCharacterOrTeam: true,
  review: true,
  GTIN: true,
};

export function BulkMetadata({ files }: { files: string[] }) {
  const [bulkStatus, setBulkStatus] = useState(ActionState.NONE);
  const [csvString, setCSVString] = useState('');
  const [csvError, setCSVError] = useState('');

  useEffect(() => {
    setBulkStatus(ActionState.NONE);
    setCSVError('');
  }, [files]);

  const uploadMetadata = async () => {
    setBulkStatus(ActionState.INPROGRESS);

    const result = Papa.parse<Metadata>(csvString, { header: true });
    const data = result.data;
    const errors = result.errors;

    if (data.length != files.length) {
      setBulkStatus(ActionState.FAILED);
      setCSVError(
        `The number of CSV rows provided does not match the number of selected files.`
      );
      return;
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
        if (!(key in validKeys)) {
          setBulkStatus(ActionState.FAILED);
          setCSVError(
            `This CSV contains invalid field "${key}" for the ComicInfo schema.`
          );
          return;
        }

        if (
          parsed[key as metadataKey] === '' ||
          parsed[key as metadataKey] === undefined ||
          parsed[key as metadataKey] === null
        ) {
          parsed[key as metadataKey] = null;
        }
      }

      metadataMap[file] = parsed;
    }

    setBulkStatus(ActionState.INPROGRESS);
    const success = await API.setBulkMetadata(metadataMap);
    setBulkStatus(success ? ActionState.SUCCESS : ActionState.FAILED);
    setCSVError(success ? '' : 'An error occured while applying metadata');
  };

  return (
    <div
      className="flex flex-col gap-2"
      style={{ height: 'calc(100% - 40px)' }}
    >
      <h6 className="text-xl font-semibold mb-2">Bulk Metadata CSV Upload</h6>
      <p className="text-sm text-muted-foreground">
        This needs to be a CSV formatted set of data where the first row is a
        header where the column names match the fields from the ComicInfo
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
      {bulkStatus == ActionState.FAILED ? (
        <p className="text-red-500">{csvError}</p>
      ) : null}
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
