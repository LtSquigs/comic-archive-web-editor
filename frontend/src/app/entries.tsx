import { useEffect, useState } from 'react';
import { ActionState } from './types';
import { Entry } from '../shared/types';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  DoubleArrowRightIcon,
  InfoCircledIcon,
  UpdateIcon,
} from '@radix-ui/react-icons';
import { API } from './api';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TooltipPortal } from '@radix-ui/react-tooltip';
import { useToast } from '@/hooks/use-toast';
type EntriesProps = {
  entries: Entry[];
  onEntriesChanged: () => {};
};

const defaultRemovalPatterns = [
  `/\\([^\\)]*\\)/g`,
  `/\\[[^\\]]*\\]/g`,
  `/\\sc\\d+\\s/g`,
  `/\\sc\\d+x\\d+\\s/g`,
  `/\\sc\\d+#\\d+\\s/g`,
  `/v\\d+-/g`,
  `/p(\\d+)/$1/g`,
  `/\\s*-+\\s+/g`,
].join('\n');

const fullRegex = /^\/(.*)(?<!\\)\/(.*)(?<!\\)\/(.*)$/;
const partialRegex = /^\/(.*)(?<!\\)\/(.*)$/;

const createEntryMap = (
  entries: Entry[],
  replacementPatterns: string[] = [],
  stripWhitespace: boolean = true,
  normalize: boolean = true,
  flattenRename: boolean = true
): string[] => {
  const regexs: { regex: RegExp; replacement: string }[] = replacementPatterns
    .map((pattern) => {
      try {
        const fullMatch = pattern.match(fullRegex);
        if (!fullMatch) {
          const partialMatch = pattern.match(partialRegex);
          if (!partialMatch) {
            return null;
          }

          const rx = partialMatch[1];
          const flags = partialMatch[2];

          return { regex: new RegExp(rx, flags), replacement: '' };
        }

        const rx = fullMatch[1];
        const replacement = fullMatch[2];
        const flags = fullMatch[3];

        return { regex: new RegExp(rx, flags), replacement: replacement };
      } catch {
        return null;
      }
    })
    .filter((x) => x !== null);

  let lastSeenNumber = -1;

  const renamedEntries = entries.map((entry) => {
    if (entry.isDirectory) {
      return {
        extName: entry.extName,
        baseName: entry.baseName,
        dir: entry.dir,
        sep: entry.sep,
      };
    }
    let baseName = entry.baseName;
    for (const regex of regexs) {
      baseName = baseName.replace(regex.regex, regex.replacement);
    }

    const ext = entry.extName === '.jpeg' ? '.jpg' : entry.extName;

    return {
      extName: ext,
      baseName: stripWhitespace ? baseName.trim() : baseName,
      dir: entry.dir,
      sep: entry.sep,
    };
  });

  const rangeRegex = /(\d+)-(\d+)/;

  let maxNumber = null;
  if (normalize) {
    maxNumber = renamedEntries.reduce((max, entry) => {
      let num = null;
      const groups = entry.baseName.match(rangeRegex);
      if (groups) {
        const num1 = groups[1] === '' ? Number.NaN : Number(groups[1]);
        const num2 = groups[2] === '' ? Number.NaN : Number(groups[2]);
        if (num1 > num2) {
          num = num1;
        } else {
          num = num2;
        }
      } else {
        num = entry.baseName === '' ? Number.NaN : Number(entry.baseName);
      }
      if (num <= lastSeenNumber) {
        num = lastSeenNumber + 1;
      }
      lastSeenNumber = num;
      if (isNaN(num)) {
        return max;
      }

      if (max === null) {
        return num;
      }

      return max > num ? max : num;
    }, null as null | number);
  }

  lastSeenNumber = -1;
  let maxDigits = null;
  if (maxNumber !== null) {
    maxDigits = Math.floor(Math.log10(maxNumber)) + 1;
  }

  return renamedEntries.map((entry) => {
    let baseName = entry.baseName;
    const groups = baseName.match(rangeRegex);

    if (normalize) {
      if (groups) {
        let num1str = groups[1];
        let num2str = groups[2];
        let num1 = num1str === '' ? Number.NaN : Number(num1str);
        let num2 = num2str === '' ? Number.NaN : Number(num2str);
        let diff = num2 - num1;

        if (maxDigits !== null && !isNaN(num1)) {
          if (num1 <= lastSeenNumber) num1 = lastSeenNumber + 1;
          lastSeenNumber = num1;
          const parts = num1.toString().split('.');
          parts[0] = parts[0].padStart(maxDigits, '0');
          num1str = parts.join('.');

          if (maxDigits !== null && !isNaN(num2)) {
            num2 = num1 + diff;
            lastSeenNumber = num2;
            const parts = num2.toString().split('.');
            parts[0] = parts[0].padStart(maxDigits, '0');
            num2str = parts.join('.');
          }
        }

        baseName = num1str + '-' + num2str;
      } else {
        let num = baseName === '' ? Number.NaN : Number(baseName);

        if (maxDigits !== null && !isNaN(num)) {
          if (num <= lastSeenNumber) num = lastSeenNumber + 1;
          lastSeenNumber = num;
          const parts = num.toString().split('.');
          parts[0] = parts[0].padStart(maxDigits, '0');
          baseName = parts.join('.');
        }
      }
    }

    if (baseName === '') {
      return '';
    }

    const fileName = baseName + entry.extName;

    if (entry.dir === null || flattenRename) {
      return fileName;
    }

    return [entry.dir, fileName].join(entry.sep);
  });
};

export function EntriesEditor({
  entries = [],
  onEntriesChanged,
}: EntriesProps) {
  const [exifStatus, setExifStatus] = useState(ActionState.NONE);
  const [flattenStatus, setFlattenStatus] = useState(ActionState.NONE);
  const [renameStatus, setRenameStatus] = useState(ActionState.NONE);
  const [mappedEntries, setMappedEntries] = useState<string[]>([]);
  const [stripWhitespace, setStripWhitespace] = useState(true);
  const [normalize, setNormalize] = useState(true);
  const [flattenRename, setFlattenRename] = useState(true);
  const [replacementPatterns, setReplacementPatterns] = useState<string>(
    defaultRemovalPatterns
  );
  const { toast } = useToast();

  const refresh = () => {
    setMappedEntries(
      createEntryMap(
        entries,
        replacementPatterns.split('\n'),
        stripWhitespace,
        normalize,
        flattenRename
      )
    );
  };

  useEffect(() => {
    if (entries.length <= 1) return;
    refresh();
  }, [entries, replacementPatterns, stripWhitespace, normalize, flattenRename]);

  const sendRemap = async () => {
    const map: { [key: string]: string } = {};
    for (let i = 0; i < entries.length; i++) {
      map[entries[i].entryName] = mappedEntries[i];
    }
    setRenameStatus(ActionState.INPROGRESS);
    const renamedEntries = await API.renameEntries(map);
    await onEntriesChanged();
    setRenameStatus(ActionState.NONE);

    toast({
      title: !renamedEntries.error ? 'Task Finished' : 'Task Failed',
      variant: !renamedEntries.error ? 'default' : 'destructive',
      description: !renamedEntries.error
        ? 'Renaming entries completed.'
        : `Error occured while renaming entries: ${renamedEntries.errorStr}.`,
    });
  };

  const onFlattenEntries = async () => {
    setFlattenStatus(ActionState.INPROGRESS);
    const flattened = await API.flattenEntries();
    await onEntriesChanged();
    setFlattenStatus(ActionState.NONE);

    toast({
      title: !flattened.error ? 'Task Finished' : 'Task Failed',
      variant: !flattened.error ? 'default' : 'destructive',
      description: !flattened.error
        ? 'Flattening entries completed.'
        : `Error occured while flattening entries: ${flattened.errorStr}.`,
    });
  };

  const onRemoveExif = async () => {
    setExifStatus(ActionState.INPROGRESS);
    const exif = await API.removeExif();
    await onEntriesChanged();
    setExifStatus(ActionState.NONE);

    toast({
      title: !exif.error ? 'Task Finished' : 'Task Failed',
      variant: !exif.error ? 'default' : 'destructive',
      description: !exif.error
        ? 'Removing EXIF data completed.'
        : `Error occured while removing EXIF data: ${exif.errorStr}`,
    });
  };

  return (
    <div className="h-fit mt-4 ml-1">
      <div className="flex flex-col gap-2 items-start">
        <div className="flex">
          <Button
            disabled={
              renameStatus === ActionState.INPROGRESS ||
              flattenStatus === ActionState.INPROGRESS
            }
            onClick={onRemoveExif}
          >
            {exifStatus === ActionState.INPROGRESS ? (
              <UpdateIcon className="mr-1 animate-spin" />
            ) : null}{' '}
            Remove EXIF From Entries
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="flex items-start">
                <InfoCircledIcon width={20} height={20} className="ml-2" />
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Removes all EXIF and EXIF-like data from images within the
                  archives.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex">
          <Button
            disabled={
              renameStatus === ActionState.INPROGRESS ||
              exifStatus === ActionState.INPROGRESS
            }
            onClick={onFlattenEntries}
          >
            {flattenStatus === ActionState.INPROGRESS ? (
              <UpdateIcon className="mr-1 animate-spin" />
            ) : null}{' '}
            Flatten Entries
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="flex items-start">
                <InfoCircledIcon width={20} height={20} className="ml-2" />
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Flattens the files in the archive to remove directories. Will
                  error if there are duplicate names.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      {entries.length > 0 ? (
        <>
          <Separator className="mb-4 mt-4" />
          <div className="flex">
            <div className="flex flex-col h-fit space-y-2 sticky top-0">
              <div className="flex items-center space-x-2">
                <Switch
                  defaultChecked
                  onCheckedChange={(checked: boolean) => {
                    setStripWhitespace(checked);
                  }}
                />
                <Label>Strip Whitespace</Label>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-start">
                      <InfoCircledIcon />
                    </TooltipTrigger>
                    <TooltipPortal>
                      <TooltipContent>
                        <p>
                          Strips any whitespace from the start/end of the
                          filenames.
                        </p>
                      </TooltipContent>
                    </TooltipPortal>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  defaultChecked
                  onCheckedChange={(checked: boolean) => {
                    setNormalize(checked);
                  }}
                />
                <Label>Normalize Numbers</Label>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-start">
                      <InfoCircledIcon />
                    </TooltipTrigger>
                    <TooltipPortal>
                      <TooltipContent>
                        <p>
                          Attempts to normalize the padding on numbers to the
                          largest number.
                        </p>
                        <p>
                          e.g. if the largest number is 357. then 1 -{'>'} 001,
                          02 -{'>'} 002
                        </p>
                      </TooltipContent>
                    </TooltipPortal>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  defaultChecked
                  onCheckedChange={(checked: boolean) => {
                    setFlattenRename(checked);
                  }}
                />
                <Label>Flatten Directories</Label>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-start">
                      <InfoCircledIcon />
                    </TooltipTrigger>
                    <TooltipPortal>
                      <TooltipContent>
                        <p>Removes all directories when renaming entries</p>
                      </TooltipContent>
                    </TooltipPortal>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div>
                <div className="flex">
                  <Label>Replacement Regex</Label>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-start ml-2">
                        <InfoCircledIcon />
                      </TooltipTrigger>
                      <TooltipPortal>
                        <TooltipContent>
                          <p>
                            Regexs to apply to the entries to rename them. Uses
                            Standard JS regex format.
                          </p>
                          <p>
                            If a rule result in a filename becoming an empty
                            string, that file will be deleted from the archive.
                          </p>
                        </TooltipContent>
                      </TooltipPortal>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Textarea
                  onChange={(event) => {
                    setReplacementPatterns(event.target.value);
                  }}
                  className="resize-none mt-1"
                  rows={10}
                  value={replacementPatterns}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  disabled={
                    flattenStatus === ActionState.INPROGRESS ||
                    exifStatus === ActionState.INPROGRESS
                  }
                  onClick={sendRemap}
                >
                  {renameStatus === ActionState.INPROGRESS ? (
                    <UpdateIcon className="mr-1 animate-spin" />
                  ) : null}{' '}
                  Rename Entries
                </Button>
              </div>
            </div>
            <div className="flex ml-4">
              <Table className="text-center">
                <TableHeader>
                  <TableRow>
                    <TableHead>Current Entry</TableHead>
                    <TableHead></TableHead>
                    <TableHead>Renamed Entry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((item, idx) => {
                    return (
                      <TableRow>
                        <TableCell>{item.entryName}</TableCell>
                        <TableCell>
                          <DoubleArrowRightIcon />
                        </TableCell>
                        <TableCell>{mappedEntries[idx]}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default EntriesEditor;
