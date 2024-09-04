import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { ActionState } from './types';
import { Entry } from '../shared/types';

import { Button } from '@/components/ui/button';
import {
  TriangleLeftIcon,
  TriangleRightIcon,
  UpdateIcon,
} from '@radix-ui/react-icons';
import { API } from './api';
import { useToast } from '@/hooks/use-toast';

export const CoverSelector = forwardRef(function CoverSelector(
  {
    files = [],
    entries = [],
    disabled = false,
  }: {
    files: string[];
    entries: Entry[];
    disabled: boolean;
  },
  ref
) {
  const [coverURL, setCoverURL] = useState('');
  const [editing, setEditing] = useState(false);
  const [coverIdx, setCoverIdx] = useState(0);
  const [coverStatus, setCoverStatus] = useState(ActionState.NONE);
  const { toast } = useToast();
  useImperativeHandle(
    ref,
    () => {
      return {
        cancelEditing: async () => {
          if (editing) setEditing(false);
        },
      };
    },
    [editing]
  );
  useEffect(() => {
    if (files.length > 1) {
      setCoverURL('');
      return;
    }
    setCoverURL(API.getCoverUrl() + '&rand=' + Math.random());
  }, [files]);

  const startEditing = () => {
    setEditing(true);
  };

  const updatePage = (idx: number) => {
    setCoverIdx(idx);
  };

  const setCover = async () => {
    setCoverStatus(ActionState.INPROGRESS);
    const cover = await API.setCover(entries[coverIdx]);
    setCoverStatus(ActionState.NONE);

    toast({
      title: !cover.error ? 'Task Finished' : 'Task Failed',
      variant: !cover.error ? 'default' : 'destructive',
      description: !cover.error
        ? 'Setting cover completed.'
        : `Error occured while setting cover: ${cover.errorStr}.`,
    });

    setEditing(false);
    setCoverIdx(0);
    setCoverURL(API.getCoverUrl() + '&rand=' + Math.random());
  };

  if (editing) {
    const currentEntry = entries[coverIdx];
    return (
      <div className="relative">
        <img
          src={API.getImageUrl(files[0], currentEntry.entryName)}
          className="max-w-full max-h-full"
        />
        {coverIdx - 1 >= 0 ? (
          <div className="absolute h-full left-0 top-0 flex items-center">
            <Button
              variant={'ghost'}
              className="h-full pl-1 pr-1 rounded-none bg-primary/30 hover:bg-primary/80 text-accent-foreground hover:text-slate-50"
              onClick={() => {
                updatePage(coverIdx - 1);
              }}
            >
              <TriangleLeftIcon width={30} height={30} />
            </Button>
          </div>
        ) : null}

        {coverIdx + 1 < entries.length ? (
          <div className="absolute h-full right-0 top-0 flex items-center">
            <Button
              variant={'ghost'}
              className="h-full pl-1 pr-1 rounded-none bg-primary/30 hover:bg-primary/80 text-accent-foreground hover:text-slate-50"
              onClick={() => {
                updatePage(coverIdx + 1);
              }}
            >
              <TriangleRightIcon width={30} height={30} />
            </Button>
          </div>
        ) : null}

        <Button
          onClick={setCover}
          className="absolute bottom-0 opacity-80"
          style={{
            width: 'calc(100% - 60px - 1rem)',
            marginLeft: 'calc(30px + 0.5rem)',
          }}
        >
          {coverStatus === ActionState.INPROGRESS ? (
            <UpdateIcon className="mr-1 animate-spin" />
          ) : null}{' '}
          Set As Cover
        </Button>
      </div>
    );
  }

  return (
    <>
      {coverURL === '' ? (
        <div className="w-full h-full flex justify-center items-center">
          <b>Multiple Files Selected</b>
        </div>
      ) : (
        <div className="relative">
          <img src={coverURL} className="max-w-full max-h-full" />
          <Button
            onClick={startEditing}
            className="absolute bottom-0 opacity-80 w-full"
            disabled={disabled}
          >
            Change Cover
          </Button>
        </div>
      )}
    </>
  );
});
export default CoverSelector;
