import { useEffect, useRef, useState } from 'react';
import { ActionState } from './types';

import { Entry, Metadata, APIMetadata, BaseMetadata } from '../shared/types';

import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { UpdateIcon } from '@radix-ui/react-icons';
import { API } from './api';
import CoverSelector from './coverSelector';
import { useToast } from '@/hooks/use-toast';
import { MetadataFields } from './utils';
import MetadataInput from './metadataInput';
import MetadataScraper from './metadataScraper';

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

  const updateValue = (name: string) => {
    return (value: any) => {
      setCurrentMetadata((prevValue) => {
        const cloned = { ...prevValue };
        (cloned as any)[name] = value;
        return cloned;
      });
    };
  };

  const topFields: [keyof BaseMetadata, number][] = [
    ['title', 2],
    ['number', 1],
    ['count', 1],
    ['storyArc', 2],
    ['storyArcNumber', 2],

    ['series', 2],
    ['volume', 2],
    ['localizedSeries', 2],
    ['seriesSort', 2],

    ['writer', 2],
    ['translator', 2],
    ['inker', 2],
    ['editor', 2],

    ['year', 1],
    ['month', 1],
    ['date', 1],
    ['ageRating', 1],
    ['blackAndWhite', 2],
    ['manga', 1],
    ['languageISO', 1],

    ['genre', 2],
    ['tags', 2],
    ['format', 2],
    ['GTIN', 2],

    ['publisher', 4],
    ['imprint', 4],
    ['web', 3],

    ['summary', 11],
  ];

  const bottomFields: [keyof BaseMetadata | '', number][] = [
    ['penciller', 2],
    ['colorist', 2],
    ['letterer', 2],
    ['coverArtist', 2],
    ['', 3],

    ['characters', 2],
    ['teams', 2],
    ['mainCharacterOrTeam', 2],
    ['locations', 2],
    ['communityRating', 2],
    ['', 1],

    ['alternateSeries', 2],
    ['alternateNumber', 2],
    ['alternateCount', 2],
    ['seriesGroup', 2],
    ['pageCount', 2],
    ['', 1],

    ['notes', 11],

    ['review', 11],

    ['scanInformation', 11],
  ];

  return (
    <>
      <div className="mt-4 p-4 grid grid-cols-11 gap-4 content-start">
        <div className="col-span-3 row-span-5 relative">
          <div className="mb-2 w-full">
            <MetadataScraper
              fullMetadata={currentMetadata}
              onUpdateMetadata={(metadata) => {
                setCurrentMetadata(metadata);
              }}
            ></MetadataScraper>
          </div>
          <CoverSelector
            disabled={metadataStatus === ActionState.INPROGRESS}
            files={files}
            entries={entries}
            ref={coverRef}
          ></CoverSelector>
        </div>
        {topFields.map(([key, span]) => {
          return (
            <MetadataInput
              field={(MetadataFields as any)[key]}
              value={(currentMetadata as any)[key]}
              span={span}
              onValueChange={updateValue(key)}
            />
          );
        })}

        <div className="col-span-11 mt-4 mb-4">
          <Separator
            className="w-full h-0.5 mb-2"
            orientation="horizontal"
          ></Separator>
          <h4>Other Fields</h4>
        </div>
        {bottomFields.map(([key, span]) => {
          if (key === '') {
            return <div className={`h-fit col-span-${span}`}></div>;
          }
          return (
            <MetadataInput
              field={(MetadataFields as any)[key]}
              value={(currentMetadata as any)[key]}
              span={span}
              onValueChange={updateValue(key)}
            />
          );
        })}

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
