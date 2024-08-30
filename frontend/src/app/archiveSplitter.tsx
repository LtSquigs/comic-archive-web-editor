import { useEffect, useState } from 'react';
import { ActionState, Entry, SplitMarker } from './types';

import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UpdateIcon } from '@radix-ui/react-icons';
import { Cross1Icon } from '@radix-ui/react-icons';
import { Input } from '@/components/ui/input';
import ImageList from './imageList';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { API } from './api';

export function ArchiveSplitter({
  entries,
  file,
  onSplit,
}: {
  entries: Entry[];
  file: string;
  onSplit: () => {};
}) {
  const [splitStatus, setSplitStatus] = useState(ActionState.NONE);
  const [markerSuffix, setMarkerSuffix] = useState<string>('');
  const [splitMarkers, setSplitMarkers] = useState<SplitMarker[]>([]);

  useEffect(() => {
    setSplitStatus(ActionState.NONE);
    setSplitMarkers([]);
  }, [file, entries]);

  const updateMarkerSuffix = (suffix: string) => {
    setMarkerSuffix(suffix);
  };

  const addSplitMarker = (entry: Entry) => {
    const existingMarker = splitMarkers.find(
      (marker) => marker.startEntry === entry.entryName
    );
    const newMarker = {
      startEntry: entry.entryName,
      endEntry: '',
      suffix: markerSuffix,
    };

    setMarkerSuffix('');

    if (existingMarker) {
      setSplitMarkers((prevValue) => {
        const newArray = prevValue.concat([]);
        const oldMarker = prevValue.find(
          (marker) => marker.startEntry === entry.entryName
        );
        (oldMarker || ({} as any)).suffix = newMarker.suffix;

        return newArray;
      });
      return;
    }

    setSplitMarkers((prevValue) => {
      const newArray = prevValue.concat([newMarker]);
      newArray.sort((a, b) => {
        if (a.startEntry > b.startEntry) {
          return 1;
        }
        if (a.startEntry < b.startEntry) {
          return -1;
        }
        return 0;
      });

      const calculatedArray: SplitMarker[] = [];
      for (let i = 0; i < newArray.length; i++) {
        const curEntry = newArray[i];
        const nextEntry = newArray[i + 1] || { startEntry: '' };

        let prevEntry = entries[0];
        for (let entry of entries) {
          if (entry.isDirectory || !entry.isImage) {
            continue;
          }
          if (entry.entryName === nextEntry.startEntry) {
            calculatedArray.push({
              startEntry: curEntry.startEntry,
              endEntry: prevEntry.entryName,
              suffix: curEntry.suffix,
            });
          }

          prevEntry = entry;
        }

        if (nextEntry.startEntry === '') {
          calculatedArray.push({
            startEntry: curEntry.startEntry,
            endEntry: prevEntry.entryName,
            suffix: curEntry.suffix,
          });
        }
      }

      return calculatedArray;
    });
  };

  const removeMarker = (entry: Entry) => {
    setSplitMarkers((prevValue) => {
      const newArray = prevValue.filter(
        (marker) => marker.startEntry !== entry.entryName
      );
      const calculatedArray: SplitMarker[] = [];
      for (let i = 0; i < newArray.length; i++) {
        const curEntry = newArray[i];
        const nextEntry = newArray[i + 1] || { startEntry: '' };

        let prevEntry = entries[0];
        for (let entry of entries) {
          if (entry.isDirectory || !entry.isImage) {
            continue;
          }
          if (entry.entryName === nextEntry.startEntry) {
            calculatedArray.push({
              startEntry: curEntry.startEntry,
              endEntry: prevEntry.entryName,
              suffix: curEntry.suffix,
            });
          }

          prevEntry = entry;
        }

        if (nextEntry.startEntry === '') {
          calculatedArray.push({
            startEntry: curEntry.startEntry,
            endEntry: prevEntry.entryName,
            suffix: curEntry.suffix,
          });
        }
      }

      return calculatedArray;
    });
  };

  const splitArchive = async () => {
    setSplitStatus(ActionState.INPROGRESS);
    const success = await API.splitArchive(splitMarkers, entries);
    setSplitStatus(success ? ActionState.SUCCESS : ActionState.FAILED);
    setMarkerSuffix('');
    setSplitMarkers([]);

    onSplit();
  };

  const renderControls = (index: number) => {
    return (
      <ScrollArea className="h-full min-w-[400px]">
        <div className="pl-4 pr-4 gap-4 flex flex-col">
          <h6 className="text-xl font-semibold mb-2">Split Markers</h6>
          <Input
            value={markerSuffix}
            onChange={(event) => {
              updateMarkerSuffix(event.target.value);
            }}
          ></Input>
          <Button onClick={() => addSplitMarker(entries[index])}>
            Add Split Marker
          </Button>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry Start</TableHead>
                <TableHead>Entry End</TableHead>
                <TableHead>File Suffix</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {splitMarkers.map((item) => {
                return (
                  <TableRow>
                    <TableCell>{item.startEntry}</TableCell>
                    <TableCell>{item.endEntry}</TableCell>
                    <TableCell>{item.suffix}</TableCell>
                    <TableCell className="cursor-pointer">
                      <Cross1Icon
                        onClick={() => removeMarker(entries[index])}
                      ></Cross1Icon>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <Separator></Separator>
          <div className="flex flex-col justify-center ml-4 gap-4">
            <Button
              disabled={splitStatus === ActionState.INPROGRESS}
              onClick={() => {
                splitArchive();
              }}
            >
              {splitStatus === ActionState.INPROGRESS ? (
                <UpdateIcon className="mr-1 animate-spin" />
              ) : null}{' '}
              Split Archive
            </Button>
            {splitStatus === ActionState.FAILED ? (
              <Badge variant={'destructive'}>Split Archive Failed</Badge>
            ) : splitStatus === ActionState.SUCCESS ? (
              <Badge variant={'default'}>Split Archive Finished</Badge>
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
      controls={renderControls}
    ></ImageList>
  );
}

export default ArchiveSplitter;
