import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { APIMetadata } from '@/shared/types';
import MetadataInput from './metadataInput';
import { MetadataFields } from './utils';
import { useEffect, useState } from 'react';

export function ScraperResult({
  metadata,
  onMerge,
}: {
  metadata: APIMetadata;
  onMerge: (metadata: APIMetadata) => void;
}) {
  const [currentMetadata, setCurrentMetadata] = useState(metadata);
  useEffect(() => {
    setCurrentMetadata(metadata);
  }, [metadata]);
  // Create an order here
  const orderedFields = [
    'title',
    'number',
    'count',
    'storyArc',
    'genre',
    'summary',
    'communityRating',

    'characters',
    'locations',
    'teams',

    'publisher',

    'writer',
    'coverArtist',
    'editor',
    'letterer',
    'translator',
    'penciller',
    'inker',
    'colorist',
    'year',
    'month',
    'date',
  ];

  const updateValue = (key: string) => {
    return (value: any) => {
      setCurrentMetadata((prevValue) => {
        const clone = { ...prevValue };

        (clone as any)[key] = value;

        return clone;
      });
    };
  };

  const removeValue = (key: string) => {
    return () => {
      setCurrentMetadata((prevValue) => {
        const clone = { ...prevValue };

        delete (clone as any)[key];

        return clone;
      });
    };
  };

  return (
    <>
      <h6 className="mb-2">Results</h6>
      <Separator className="mb-2"></Separator>
      {orderedFields
        .map((key) => {
          if (!(key in currentMetadata)) return null;
          return (
            <div className="mb-2">
              <MetadataInput
                field={(MetadataFields as any)[key]}
                value={(currentMetadata as any)[key]}
                span={1}
                onValueChange={updateValue(key)}
                canCancel
                onCancel={removeValue(key)}
              ></MetadataInput>
            </div>
          );
        })
        .filter((x) => x !== null)}
      <div className={'text-xs mb-2'}>
        Non-empty fields will overwrite existing fields in the UI, you must
        still save changes after overwriting.
      </div>
      <Button
        onClick={() => {
          onMerge(currentMetadata);
        }}
      >
        Overwrite Metadata
      </Button>
    </>
  );
}

export default ScraperResult;
