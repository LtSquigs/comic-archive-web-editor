import { ReactElement, useEffect, useRef, useState } from 'react';
import { Entry } from './types';

import { Separator } from '@/components/ui/separator';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

export function ImageList({
  entries,
  file,
  controls = null,
  multipleImages = false,
  imageControls = null,
  leftToRight = false,
}: {
  entries: Entry[];
  file: string;
  controls?: ((index: number) => ReactElement | null) | null;
  multipleImages?: boolean;
  imageControls?: ((index: number) => ReactElement | null) | null;
  leftToRight?: boolean;
}) {
  const [currentEntry, setCurrentEntry] = useState(null as Entry | null);
  const [currentEntryIdx, setCurrentEntryIdx] = useState(0);
  const buttonsRef = useRef<Map<string, HTMLButtonElement> | null>(null);

  function getButtonRefs() {
    if (!buttonsRef.current) {
      buttonsRef.current = new Map();
    }
    return buttonsRef.current;
  }

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (['INPUT', 'BUTTON'].includes((event.target as any).tagName)) {
        return;
      }
      const increment = event.shiftKey ? 2 : 1;
      const refs = getButtonRefs();
      if (event.key === 'ArrowRight') {
        if (currentEntryIdx + increment < entries.length) {
          changePage(
            entries[currentEntryIdx + increment],
            currentEntryIdx + increment
          );

          refs
            .get(entries[currentEntryIdx + increment].entryName)
            ?.scrollIntoView();
        }

        event.stopPropagation();
        event.preventDefault();
      }

      if (event.key === 'ArrowLeft') {
        if (currentEntryIdx - increment >= 0) {
          changePage(
            entries[currentEntryIdx - increment],
            currentEntryIdx - increment
          );

          refs
            .get(entries[currentEntryIdx - increment].entryName)
            ?.scrollIntoView();
        }

        event.stopPropagation();
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  });

  useEffect(() => {
    if (entries.length > 0) {
      setCurrentEntry(entries[0]);
      setCurrentEntryIdx(0);
    }
  }, [entries]);

  const changePage = (entry: Entry, idx: number) => {
    setCurrentEntry(entry);
    setCurrentEntryIdx(idx);
  };

  if (currentEntry === null) {
    return <></>;
  }

  return (
    <div style={{ height: 'calc(100vh - 40px - 2.5rem)' }}>
      <div style={{ height: 'calc(100% - 68px - 2rem)' }}>
        <div className="flex h-full relative">
          {!leftToRight &&
          multipleImages &&
          currentEntryIdx + 1 < entries.length ? (
            <div className="max-h-full h-full flex flex-col justify-center">
              <img
                className="max-h-full max-w-full"
                src={`/cbz/image?files=${file}&entry=${
                  entries[currentEntryIdx + 1].entryName
                }`}
              />
            </div>
          ) : null}
          <div className="max-h-full h-full flex flex-col justify-center relative">
            <img
              className="max-h-full max-w-full"
              src={`/cbz/image?files=${file}&entry=${currentEntry.entryName}`}
            />
            {imageControls ? imageControls(currentEntryIdx) : null}
          </div>
          {leftToRight &&
          multipleImages &&
          currentEntryIdx + 1 < entries.length ? (
            <div className="max-h-full h-full flex flex-col justify-center">
              <img
                className="max-h-full max-w-full"
                src={`/cbz/image?files=${file}&entry=${
                  entries[currentEntryIdx + 1].entryName
                }`}
              />
            </div>
          ) : null}
          {controls ? controls(currentEntryIdx) : null}
        </div>
      </div>
      <Separator orientation="horizontal" className="mt-4 mb-4" />
      <ScrollArea className="w-full whitespace-nowrap rounded-md border">
        <div className="flex w-max space-x-4 p-4">
          {entries.map((entry, idx) => {
            return (
              <Button
                variant={
                  currentEntry.entryName === entry.entryName
                    ? 'default'
                    : 'secondary'
                }
                onClick={() => {
                  changePage(entry, idx);
                }}
                ref={(node) => {
                  const refs = getButtonRefs();
                  if (node) {
                    refs.set(entry.entryName, node);
                  } else {
                    refs.delete(entry.entryName);
                  }
                }}
              >
                {entry.entryName}
              </Button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

export default ImageList;
