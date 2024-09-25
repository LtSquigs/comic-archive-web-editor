import { Button } from '@/components/ui/button';
import { API } from './api';
import {
  DragHandleDots2Icon,
  PlusIcon,
  UpdateIcon,
} from '@radix-ui/react-icons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useEffect, useRef, useState } from 'react';
import { ActionState } from './types';
import { useToast } from '@/hooks/use-toast';
import {
  Sortable,
  SortableDragHandle,
  SortableItem,
} from '@/components/extension/sortable';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getEntryNumber, range } from './utils';
import { number } from 'zod';
import { Merge } from '@/shared/types';

export function MergeButton({
  files,
  onMerge,
}: {
  files: string[];
  onMerge: (newFile: string) => {};
}) {
  const [saveFile, setSaveFile] = useState(
    files[0].replace(/\.cbz/, ' m.cbz').replace(/\.zip/, ' merged.zip')
  );
  const [isOpen, setIsOpen] = useState(false);
  const [merging, setMerging] = useState(ActionState.NONE);
  const [items, setItems] = useState<{ id: string }[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    setSaveFile(
      files[0].replace(/\.cbz/, ' merged.cbz').replace(/\.zip/, ' merged.zip')
    );
  }, [files]);

  useEffect(() => {
    const sortedFiles = [...files];
    sortedFiles.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
    setItems(
      sortedFiles.map((file) => ({
        id: file,
      }))
    );
  }, [files]);

  const mergeFiles = async () => {
    setMerging(ActionState.INPROGRESS);
    let fileMap = [];
    const seenEntries: any = {};
    let lastNumber = 0;
    for (const { id: file } of items) {
      const entries = await API.getEntries(file);
      if (entries.error) {
        toast({
          title: 'Task Failed',
          variant: 'destructive',
          description: `Error occured while retrieving entries. Aborted merge: ${entries.errorStr}.`,
        });
        setMerging(ActionState.NONE);
        return;
      }
      fileMap.push({
        file,
        entries: entries.data
          .map((entry) => {
            const { prefix, number, secondNumber } = getEntryNumber(
              entry.baseName
            );
            if (
              seenEntries[`${prefix};;;${number}`] ||
              seenEntries[`${prefix};;;${secondNumber}`]
            ) {
              if (
                entry.baseName.match(/^comicinfo$/gi) ||
                entry.baseName.match(/^cover$/gi)
              ) {
                return null;
              }

              if (number !== null && secondNumber !== null) {
                if (secondNumber > number) {
                  const newNumber =
                    lastNumber + 1 + (number - Math.floor(number));
                  const diff = secondNumber - number;
                  const newSecondNumber = newNumber + diff;
                  lastNumber = Math.floor(newSecondNumber);
                  range(newNumber, newSecondNumber).forEach((num) => {
                    seenEntries[`${prefix};;;${num}`] = true;
                  });
                  return {
                    entry,
                    prefix,
                    number: newNumber,
                    secondNumber: newSecondNumber,
                  };
                }
                const newNumber =
                  lastNumber + 1 + (secondNumber - Math.floor(secondNumber));
                const diff = number - secondNumber;
                const newSecondNumber = newNumber + diff;
                lastNumber = Math.floor(newSecondNumber);
                range(newNumber, newSecondNumber).forEach((num) => {
                  seenEntries[`${prefix};;;${num}`] = true;
                });
                return {
                  entry,
                  prefix,
                  number: newSecondNumber,
                  secondNumber: newNumber,
                };
              }

              if (number !== null) {
                const newNumber =
                  lastNumber + 1 + (number - Math.floor(number));
                lastNumber = Math.floor(newNumber);
                seenEntries[`${prefix};;;${newNumber}`] = true;

                return {
                  entry,
                  prefix,
                  number: newNumber,
                  secondNumber,
                };
              }

              for (let i = 0; i < 1000; i++) {
                const newPrefix = prefix + `${i}`;
                if (seenEntries[`${newPrefix};;;${number}`]) {
                  continue;
                }
                seenEntries[`${newPrefix};;;${number}`] = true;
                return { entry, prefix: newPrefix, number, secondNumber };
              }

              throw new Error('too many files with the same name');
            }

            if (number !== null) {
              lastNumber =
                secondNumber !== null && secondNumber > number
                  ? Math.floor(secondNumber)
                  : Math.floor(number);
            }
            if (number !== null && secondNumber !== null) {
              range(number, secondNumber).forEach((num) => {
                seenEntries[`${prefix};;;${num}`] = true;
              });
            } else {
              seenEntries[`${prefix};;;${number}`] = true;
            }
            return { entry, prefix, number, secondNumber };
          })
          .filter((x) => x !== null),
      });
    }
    const merges: Merge[] = fileMap.map((pair) => {
      return {
        file: pair.file,
        entries: pair.entries.map(({ prefix, entry, number, secondNumber }) => {
          let maxDigits = 0;
          if (lastNumber !== null) {
            maxDigits = Math.floor(Math.log10(lastNumber)) + 1;
          }

          if (number !== null && secondNumber !== null) {
            return {
              old: entry.entryName,
              new:
                prefix +
                `${number}`.padStart(maxDigits, '0') +
                `-${secondNumber}`.padStart(maxDigits, '0') +
                entry.extName,
            };
          }

          if (number !== null) {
            return {
              old: entry.entryName,
              new:
                prefix + `${number}`.padStart(maxDigits, '0') + entry.extName,
            };
          }

          return { old: entry.entryName, new: prefix + entry.extName };
        }),
      };
    });

    const res = await API.mergeArchives(saveFile, merges);

    toast({
      title: !res.error ? 'Task Finished' : 'Task Failed',
      variant: !res.error ? 'default' : 'destructive',
      description: !res.error
        ? 'Merging archive completed.'
        : `Error occured while merging archive: ${res.errorStr}.`,
    });

    if (!res.error) {
      await onMerge(saveFile);
    }

    setIsOpen(false);
    setMerging(ActionState.NONE);
  };

  return (
    <Dialog
      onOpenChange={(open) => {
        setIsOpen(open);
      }}
      open={isOpen}
    >
      <DialogTrigger>
        <Button className="mr-2">Merge Files</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)]">
        <DialogHeader style={{ maxHeight: 'calc(100vh - 6rem - 40px)' }}>
          <DialogTitle>Move Archive</DialogTitle>
          <DialogDescription></DialogDescription>
          <ScrollArea>
            <div className="pl-2 pr-2">
              <Label className="mb-2">Merged File Name</Label>
              <Input
                value={saveFile}
                onChange={(e) => setSaveFile(e.target.value)}
              ></Input>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filename</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <Sortable
                  value={items}
                  onValueChange={(items) => {
                    setItems(items);
                  }}
                >
                  {items.map((item, idx) => {
                    return (
                      <SortableItem value={item.id} key={item.id} asChild>
                        <TableRow>
                          <TableCell>{item.id}</TableCell>
                          <TableCell>#{idx + 1}</TableCell>
                          <TableCell>
                            <SortableDragHandle
                              variant="outline"
                              size="icon"
                              className="ml-2 size-8 shrink-0"
                            >
                              <DragHandleDots2Icon
                                className="size-4"
                                aria-hidden="true"
                              />
                            </SortableDragHandle>
                          </TableCell>
                        </TableRow>
                      </SortableItem>
                    );
                  })}
                </Sortable>
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogHeader>
        <DialogFooter>
          <Button
            disabled={merging === ActionState.INPROGRESS}
            onClick={mergeFiles}
          >
            {merging === ActionState.INPROGRESS ? (
              <UpdateIcon className="mr-1 animate-spin" />
            ) : null}{' '}
            Merge Archives
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MergeButton;
