import { useEffect, useState } from 'react';
import { ActionState, Entry, Metadata, Page } from './types';

import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UpdateIcon } from '@radix-ui/react-icons';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import ImageList from './imageList';
import { API } from './api';

function PageMetadataEditor({
  pageNumber,
  pageMetadata,
  onChangeField,
}: {
  pageNumber: number;
  pageMetadata: Page;
  onChangeField: (
    field: 'type' | 'doublePage' | 'bookmark' | 'key',
    value: any
  ) => void;
}) {
  const [type, setType] = useState((pageMetadata.type as string) || '');
  const [doublePage, setDoublePage] = useState(
    (pageMetadata.doublePage as boolean) || false
  );
  const [bookmark, setBookmark] = useState(
    (pageMetadata.bookmark as string) || ''
  );
  const [key, setKey] = useState((pageMetadata.key as string) || '');

  useEffect(() => {
    setType((pageMetadata.type as string) || '');
    setDoublePage((pageMetadata.doublePage as boolean) || false);
    setBookmark((pageMetadata.bookmark as string) || '');
    setKey((pageMetadata.key as string) || '');
  }, [pageMetadata]);

  return (
    <>
      <h6 className="text-xl font-semibold mb-2">Edit Page Metadata</h6>
      <div>
        <Label>Page #: {pageNumber}</Label>
      </div>
      <Label>Page Type</Label>
      <ToggleGroup
        className="flex justify-start flex-wrap w-[300px] mt-2 mb-2"
        variant={'outline'}
        type="single"
        onValueChange={(value) => {
          setType(value);
          onChangeField('type', value);
        }}
        value={type}
      >
        <ToggleGroupItem value="FrontCover">Front Cover</ToggleGroupItem>
        <ToggleGroupItem value="InnerCover">Inner Cover</ToggleGroupItem>
        <ToggleGroupItem value="Roundup">Roundup</ToggleGroupItem>
        <ToggleGroupItem value="Story">Story</ToggleGroupItem>
        <ToggleGroupItem value="Advertisement">Advertisement</ToggleGroupItem>
        <ToggleGroupItem value="Editorial">Editorial</ToggleGroupItem>
        <ToggleGroupItem value="Letters">Letters</ToggleGroupItem>
        <ToggleGroupItem value="Preview">Preview</ToggleGroupItem>
        <ToggleGroupItem value="BackCover">Back Cover</ToggleGroupItem>
        <ToggleGroupItem value="Other">Other</ToggleGroupItem>
        <ToggleGroupItem value="Deleted">Deleted</ToggleGroupItem>
      </ToggleGroup>
      <Label>Is Double Page?</Label>
      <div className="mb-2">
        <Checkbox
          checked={doublePage}
          onCheckedChange={(checked) => {
            setDoublePage(checked == 'indeterminate' ? false : checked);
            onChangeField(
              'doublePage',
              checked == 'indeterminate' ? false : checked
            );
          }}
        ></Checkbox>
      </div>
      <Label>Bookmark</Label>
      <Input
        className="mt-2 mb-2"
        value={bookmark}
        onChange={(event) => {
          setBookmark(event.target.value);
          onChangeField('bookmark', event.target.value);
        }}
      ></Input>
      <Label>Key</Label>
      <Input
        className="mt-2 mb-2"
        value={key}
        onChange={(event) => {
          setKey(event.target.value);
          onChangeField('key', event.target.value);
        }}
      ></Input>
    </>
  );
}

export function PageMetadata({
  entries,
  file,
  metadata,
}: {
  entries: Entry[];
  file: string;
  metadata: Metadata;
}) {
  const [metadataDirty, setMetadataDirty] = useState(false);
  const [currentMetadata, setCurrentMetadata] = useState<Metadata>({});
  const [metadataStatus, setMetadataStatus] = useState(ActionState.NONE);

  const onUpdateMetadata = async (metadata: Metadata) => {
    setMetadataStatus(ActionState.INPROGRESS);
    const success = await API.setMetadata(metadata);
    setMetadataStatus(success ? ActionState.SUCCESS : ActionState.FAILED);
  };

  useEffect(() => {
    const onlyPages = {
      pages: metadata.pages,
    };
    setCurrentMetadata(onlyPages);
    setMetadataStatus(ActionState.NONE);
  }, [metadata]);

  const renderMetadataEditor = (index: number) => {
    const pages = currentMetadata.pages || [];
    const pageMetadata = pages.find((val) => val.image === index) || {
      image: index,
    };

    const updateMetadataField = (
      field: 'type' | 'doublePage' | 'bookmark' | 'key',
      value: any
    ) => {
      setMetadataDirty(true);
      setCurrentMetadata((prevValue) => {
        if (!prevValue.pages) {
          prevValue.pages = [];
        }

        let obj = pages.find((val) => val.image === index);

        if (!obj) {
          obj = { image: index };
          prevValue.pages.push(obj);
        }

        if (value === '' || value === false || !value) {
          if (obj[field]) {
            delete obj[field];
          }
        } else {
          obj[field] = value;
        }

        prevValue.pages = prevValue.pages.filter((value) => {
          const pageKeys = Object.keys(value);
          // { image: # } only objects can be destroyed
          if (pageKeys.length === 1 && pageKeys[0] === 'image') {
            return false;
          }

          // {} empty objects can be destroyed
          if (pageKeys.length === 0) {
            return false;
          }

          return true;
        });

        prevValue.pages.sort((a, b) => {
          if (
            a.image === null ||
            a.image === undefined ||
            b.image === null ||
            b.image === undefined
          ) {
            return 0;
          }
          if (a.image < b.image) {
            return -1;
          }

          if (a.image > b.image) {
            return 1;
          }

          return 0;
        });

        return prevValue;
      });
    };

    const saveMetadata = async () => {
      await onUpdateMetadata(currentMetadata);
      setMetadataDirty(false);
    };

    return (
      <ScrollArea className="h-full">
        <div className="pl-4 pr-4">
          <PageMetadataEditor
            onChangeField={updateMetadataField}
            pageNumber={index}
            pageMetadata={pageMetadata}
          ></PageMetadataEditor>
          <Separator></Separator>
          <div className="mt-2 flex-col flex gap-4">
            <Button disabled={!metadataDirty} onClick={saveMetadata}>
              {metadataStatus === ActionState.INPROGRESS ? (
                <UpdateIcon className="mr-1 animate-spin" />
              ) : null}{' '}
              Save All Page Metadata
            </Button>
            {metadataStatus === ActionState.FAILED ? (
              <Badge variant={'destructive'}>Saving Metadata Failed</Badge>
            ) : metadataStatus === ActionState.SUCCESS ? (
              <Badge variant={'default'}>Saving Metadata Finished</Badge>
            ) : null}
          </div>
        </div>
      </ScrollArea>
    );
  };

  return (
    <ImageList
      entries={entries}
      file={file}
      controls={(index: number) => {
        return (
          <div className="max-h-full h-full grow">
            {renderMetadataEditor(index)}
          </div>
        );
      }}
    ></ImageList>
  );
}

export default PageMetadata;
