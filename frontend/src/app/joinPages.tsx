import { useEffect, useRef, useState } from 'react';
import { ActionState, APIResult } from './types';
import {
  APIMetadata,
  APIPage,
  Entry,
  JoinPair,
  Metadata,
} from '../shared/types';

import { Button } from '@/components/ui/button';
import { Link1Icon } from '@radix-ui/react-icons';
import { LinkBreak1Icon } from '@radix-ui/react-icons';
import { UpdateIcon } from '@radix-ui/react-icons';
import ImageList from './imageList';
import { API } from './api';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

let defaultDirection = 'RTL';

export function JoinPages({
  entries,
  file,
  metadata,
  onJoin,
}: {
  entries: Entry[];
  file: string;
  metadata: APIMetadata;
  onJoin: () => {};
}) {
  const [joinStatus, setJoinStatus] = useState(ActionState.NONE);
  const [numToJoin, setNumToJoin] = useState(0);
  const [pageDirection, setPageDirection] = useState(defaultDirection);
  const [gap, setGap] = useState(0);
  const [gapColor, setGapColor] = useState('#ffffff');
  const [joinedImages, setJoinedImages] = useState(
    {} as { [key: string]: boolean }
  );
  const { toast } = useToast();
  const joinList = useRef([] as JoinPair[]);
  const [currentEntry, setCurrentEntry] = useState(entries[0]);
  const [currentMetadata, setCurrentMetadata] = useState<APIMetadata>({});
  const [nextEntry, setNextEntry] = useState(
    entries.length > 1 ? entries[1] : null
  );

  useEffect(() => {
    const onlyPages = {
      pages: metadata.pages,
    };
    setCurrentMetadata(onlyPages);
  }, [metadata, entries]);

  useEffect(() => {
    const handleKeyPress = async (event: KeyboardEvent) => {
      if (event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) {
        return;
      }
      if (
        ['INPUT', 'BUTTON', 'TEXTAREA'].includes(
          (event.target as HTMLElement).tagName
        )
      ) {
        return;
      }
      if (event.key.toLowerCase() === 'j') {
        if (nextEntry) {
          if (pageDirection === 'LTR') {
            toggleChangeList(currentEntry, nextEntry);
          } else {
            toggleChangeList(nextEntry, currentEntry);
          }
        }
        event.stopPropagation();
        event.preventDefault();
      }

      if (event.key.toLowerCase() === 'enter') {
        if (numToJoin > 0) {
          await joinImages();
          event.stopPropagation();
          event.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  });

  useEffect(() => {
    setJoinStatus(ActionState.NONE);
    joinList.current = [];
  }, [file, entries]);

  const toggleChangeList = (leftImage: Entry, rightImage: Entry) => {
    if (
      joinedImages[leftImage.entryName] &&
      joinedImages[rightImage.entryName]
    ) {
      joinList.current = joinList.current.filter((value) => {
        return (
          value.leftImage !== leftImage.entryName &&
          value.rightImage !== rightImage.entryName
        );
      });

      setJoinedImages((prevState) => {
        prevState[rightImage.entryName] = false;
        prevState[leftImage.entryName] = false;

        return prevState;
      });
      setNumToJoin(joinList.current.length);
      return;
    }

    joinList.current.push({
      leftImage: leftImage.entryName,
      rightImage: rightImage.entryName,
    });

    setJoinedImages((prevState) => {
      prevState[rightImage.entryName] = true;
      prevState[leftImage.entryName] = true;

      return prevState;
    });
    setNumToJoin(joinList.current.length);
  };

  const joinImages = async () => {
    if (joinList.current.length >= 1) {
      setJoinStatus(ActionState.INPROGRESS);
      const join = await API.joinImages(joinList.current, gap, gapColor);
      const pageIndexes = joinList.current
        .map((pair) => {
          const leftIdx = entries.findIndex(
            (item) => item.entryName == pair.leftImage
          );
          const rightIdx = entries.findIndex(
            (item) => item.entryName == pair.rightImage
          );

          if (leftIdx < rightIdx) return leftIdx;
          return rightIdx;
        })
        .filter((x) => x >= 0);

      const newMetadata = { ...currentMetadata };
      let changed = false;
      if (newMetadata.pages && newMetadata.pages.length > 0) {
        newMetadata.pages.sort(
          (a, b) => (a.image as number) - (b.image as number)
        );
        const newPages: APIPage[] = [];

        newMetadata.pages.forEach((page) => {
          const pageShift = pageIndexes.reduce(
            (accumulator, idx) =>
              idx < (page.image as number) ? accumulator + 1 : accumulator,
            0
          );

          if (pageShift > 0) {
            changed = true;
            const existingPage = newPages.find(
              (item) => item.image == (page.image as number) - pageShift
            );
            if (!existingPage) {
              page.image = (page.image as number) - pageShift;
              newPages.push(page);
            }
          } else {
            newPages.push(page);
          }
        });

        if (newPages.length > 0) {
          newMetadata.pages = newPages;
        } else {
          newMetadata.pages = undefined;
        }
      }
      let metadata: APIResult<boolean> = { error: false, data: true };
      if (changed) {
        metadata = await API.setMetadata(newMetadata as Metadata);
        setCurrentMetadata(newMetadata);
      }
      setJoinStatus(ActionState.NONE);
      toast({
        title: !join.error && !metadata.error ? 'Task Finished' : 'Task Failed',
        variant: !join.error && !metadata.error ? 'default' : 'destructive',
        description:
          !join.error && !metadata.error
            ? 'Joining images completed.'
            : `Error occured while joining images: ${
                join.error
                  ? join.errorStr
                  : metadata.error
                  ? metadata.errorStr
                  : ''
              }.`,
      });
    }
    joinList.current = [];
    setJoinedImages({});
    setGap(0);
    setNumToJoin(0);
    onJoin();
  };

  const renderImageControls = (index: number) => {
    const currentEntry = entries[index];
    const nextEntry = entries[index + 1];

    if (!nextEntry) {
      return null;
    }

    return (
      <div
        className="absolute"
        style={
          pageDirection === 'LTR'
            ? { right: '-12px', top: 'calc(50% - 12px)' }
            : { left: '-12px', top: 'calc(50% - 12px)' }
        }
      >
        <Button
          className="pl-1 pr-1 pt-2 pb-2 h-6"
          disabled={
            (joinedImages[nextEntry.entryName] &&
              !joinedImages[currentEntry.entryName]) ||
            (!joinedImages[nextEntry.entryName] &&
              joinedImages[currentEntry.entryName])
          }
          variant={
            joinedImages[nextEntry.entryName] &&
            joinedImages[currentEntry.entryName]
              ? 'outline'
              : 'default'
          }
          onClick={() => {
            if (pageDirection === 'LTR') {
              toggleChangeList(currentEntry, nextEntry);
            } else {
              toggleChangeList(nextEntry, currentEntry);
            }
          }}
        >
          {joinedImages[nextEntry.entryName] && currentEntry.entryName ? (
            <LinkBreak1Icon />
          ) : (
            <Link1Icon />
          )}
        </Button>
      </div>
    );
  };

  return (
    <ImageList
      entries={entries}
      file={file}
      controls={() => {
        return (
          <div className="flex flex-col justify-center ml-4 gap-4">
            <p className="text-xs text-muted-foreground max-w-[200px]">
              Instructions:
              <ol className="list-decimal list-inside">
                <li className="mt-2">
                  Use left and right arrow keys to navigate images.
                </li>
                <li className="mt-2">
                  Select images to join using the link buttons between images
                  (or press "j").
                </li>
                <li className="mt-2">
                  Click the join button below to join all of the selected
                  images.
                </li>
              </ol>
            </p>
            <div>
              <Label>Page Order Direction</Label>
              <Select
                value={pageDirection}
                onValueChange={(value) => {
                  defaultDirection = value;
                  setPageDirection(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={'Reading Direction'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={'RTL'}>
                    <i>Right To Left</i>
                  </SelectItem>
                  <SelectItem value={'LTR'}>
                    <i>Left To Right</i>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Join Gap</Label>
              <Input
                type="number"
                onChange={(event) => {
                  const gap = parseInt(event.target.value);
                  setGap(isNaN(gap) ? 0 : gap);
                }}
                value={gap}
              ></Input>
            </div>
            <div>
              <Label>Gap Fill Color</Label>
              <Input
                type="color"
                onChange={(event) => {
                  setGapColor(event.target.value);
                }}
                value={gapColor}
              ></Input>
            </div>
            <Button
              disabled={joinStatus === ActionState.INPROGRESS}
              onClick={() => {
                joinImages();
              }}
            >
              {joinStatus === ActionState.INPROGRESS ? (
                <UpdateIcon className="mr-1 animate-spin" />
              ) : null}{' '}
              Combine {numToJoin} Selected Images
            </Button>
          </div>
        );
      }}
      gap={gap}
      gapColor={gapColor}
      imageControls={renderImageControls}
      onPageChange={(entry, nextEntry) => {
        setCurrentEntry(entry);
        setNextEntry(nextEntry);
      }}
      multipleImages
      leftToRight={pageDirection === 'LTR'}
    ></ImageList>
  );
}

export default JoinPages;
