import { useEffect, useRef, useState } from 'react';
import { ActionState } from './types';
import { Entry, JoinPair } from '../shared/types';

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

export function JoinPages({
  entries,
  file,
  onJoin,
}: {
  entries: Entry[];
  file: string;
  onJoin: () => {};
}) {
  const [joinStatus, setJoinStatus] = useState(ActionState.NONE);
  const [numToJoin, setNumToJoin] = useState(0);
  const [pageDirection, setPageDirection] = useState('RTL');
  const [joinedImages, setJoinedImages] = useState(
    {} as { [key: string]: boolean }
  );
  const { toast } = useToast();
  const joinList = useRef([] as JoinPair[]);
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
      const {
        data: success,
        error,
        errorStr,
      } = await API.joinImages(joinList.current);
      setJoinStatus(ActionState.NONE);
      toast({
        title: success && !error ? 'Task Finished' : 'Task Failed',
        variant: success && !error ? 'default' : 'destructive',
        description:
          success && !error
            ? 'Joining images completed.'
            : `Error occured while joining images: ${errorStr}.`,
      });
    }
    joinList.current = [];
    setJoinedImages({});
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
            toggleChangeList(nextEntry, currentEntry);
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
                  Select images to join using the link buttons between images.
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
                onValueChange={(value) => setPageDirection(value)}
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
      imageControls={renderImageControls}
      multipleImages
      leftToRight={pageDirection === 'LTR'}
    ></ImageList>
  );
}

export default JoinPages;
