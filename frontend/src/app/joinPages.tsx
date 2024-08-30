import { useEffect, useRef, useState } from 'react';
import { ActionState, Entry, JoinEntry } from './types';

import { Button } from '@/components/ui/button';
import { Link1Icon } from '@radix-ui/react-icons';
import { LinkBreak1Icon } from '@radix-ui/react-icons';
import { Badge } from '@/components/ui/badge';
import { UpdateIcon } from '@radix-ui/react-icons';
import ImageList from './imageList';
import { API } from './api';

export function JoinPages({
  entries,
  file,
}: {
  entries: Entry[];
  file: string;
}) {
  const [joinStatus, setJoinStatus] = useState(ActionState.NONE);
  const [numToJoin, setNumToJoin] = useState(0);
  const [joinedImages, setJoinedImages] = useState(
    {} as { [key: string]: boolean }
  );
  const joinList = useRef([] as JoinEntry[]);
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
      const success = await API.joinImages(joinList.current);
      setJoinStatus(success ? ActionState.SUCCESS : ActionState.FAILED);
    }
    joinList.current = [];
    setNumToJoin(0);
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
        style={{ left: '-12px', top: 'calc(50% - 12px)' }}
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
            {joinStatus === ActionState.FAILED ? (
              <Badge variant={'destructive'}>Joining Images Failed</Badge>
            ) : null}
          </div>
        );
      }}
      imageControls={renderImageControls}
      multipleImages
    ></ImageList>
  );
}

export default JoinPages;
