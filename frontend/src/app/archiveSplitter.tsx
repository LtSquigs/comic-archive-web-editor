import { useEffect, useState } from 'react';
import { ActionState, Entry, SplitMarker } from './types';

import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
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
import { useToast } from '@/hooks/use-toast';

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
  const [newFileName, setNewFileName] = useState<string>('');
  const [splitMarkers, setSplitMarkers] = useState<SplitMarker[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    setNewFileName(file);
    setSplitStatus(ActionState.NONE);
    setSplitMarkers([]);
  }, [file, entries]);

  const updateNewFileName = (newFileName: string) => {
    setNewFileName(newFileName);
  };

  const addSplitMarker = (entry: Entry) => {
    const existingMarker = splitMarkers.find(
      (marker) => marker.startEntry === entry.entryName
    );
    const newMarker = {
      startEntry: entry.entryName,
      endEntry: '',
      filename: newFileName,
    };

    const endingNumberMatch = newFileName.match(/(.* )(\d+)\.([^.]+)$/);

    if (endingNumberMatch) {
      const pre = endingNumberMatch[1];
      const num = parseInt(endingNumberMatch[2]) + 1;
      const ext = endingNumberMatch[3];

      setNewFileName(`${pre}${num}.${ext}`);
    } else {
      setNewFileName(file);
    }

    if (existingMarker) {
      setSplitMarkers((prevValue) => {
        const newArray = prevValue.concat([]);
        const oldMarker = prevValue.find(
          (marker) => marker.startEntry === entry.entryName
        );
        (oldMarker || ({} as any)).filename = newMarker.filename;

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
              filename: curEntry.filename,
            });
          }

          prevEntry = entry;
        }

        if (nextEntry.startEntry === '') {
          calculatedArray.push({
            startEntry: curEntry.startEntry,
            endEntry: prevEntry.entryName,
            filename: curEntry.filename,
          });
        }
      }

      return calculatedArray;
    });
  };

  const removeMarker = (entry: string) => {
    setSplitMarkers((prevValue) => {
      const newArray = (prevValue || []).filter(
        (marker) => marker.startEntry !== entry
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
              filename: curEntry.filename,
            });
          }

          prevEntry = entry;
        }

        if (nextEntry.startEntry === '') {
          calculatedArray.push({
            startEntry: curEntry.startEntry,
            endEntry: prevEntry.entryName,
            filename: curEntry.filename,
          });
        }
      }

      return calculatedArray;
    });
  };

  const splitArchive = async () => {
    setSplitStatus(ActionState.INPROGRESS);
    const {
      data: success,
      error,
      errorStr,
    } = await API.splitArchive(splitMarkers, entries);
    setSplitStatus(ActionState.NONE);

    toast({
      title: success && !error ? 'Task Finished' : 'Task Failed',
      variant: success && !error ? 'default' : 'destructive',
      description:
        success && !error
          ? 'Splitting archive completed.'
          : `Error occured while splitting archive: ${errorStr}.`,
    });

    setNewFileName(file);
    setSplitMarkers([]);

    onSplit();
  };

  const renderControls = (index: number) => {
    return (
      <ScrollArea className="h-full min-w-[400px]">
        <div className="pl-4 pr-4 gap-4 flex flex-col">
          <h6 className="text-xl font-semibold mb-2">Split Markers</h6>

          <p className="text-sm text-muted-foreground">
            Instructions:
            <ol className="list-decimal list-inside">
              <li className="mt-2">
                Navigate to image that you want to start new archive from using
                left and right arrow keys.
              </li>
              <li className="mt-2">
                Enter a filename for the new archive and click add split marker
              </li>
              <li className="mt-2">
                Once all markers have been added, click the Split Archive button
              </li>
            </ol>
          </p>

          <p className="text-xs text-muted-foreground">
            Note: If your filename ends with a number (e.g. "Ch 12") the system
            will pre-fill the marker input with the next number in the series
            (e.g. "Ch 13") for conveinence.
          </p>
          <Input
            value={newFileName}
            onChange={(event) => {
              updateNewFileName(event.target.value);
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
                <TableHead>File Name</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {splitMarkers.map((item) => {
                return (
                  <TableRow>
                    <TableCell>{item.startEntry}</TableCell>
                    <TableCell>{item.endEntry}</TableCell>
                    <TableCell>{item.filename}</TableCell>
                    <TableCell className="cursor-pointer">
                      <Cross1Icon
                        onClick={() => removeMarker(item.startEntry)}
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
