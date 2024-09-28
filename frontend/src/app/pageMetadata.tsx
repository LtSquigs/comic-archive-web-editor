import { useEffect, useState } from 'react';
import { ActionState } from './types';
import {
  Entry,
  APIMetadata,
  APIPage,
  Metadata,
  EntryMap,
  Page,
} from '../shared/types';

import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  Cross1Icon,
  InfoCircledIcon,
  ResetIcon,
  TrashIcon,
  UpdateIcon,
} from '@radix-ui/react-icons';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import ImageList from './imageList';
import { API } from './api';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { changeImageNum } from './utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PlusIcon } from 'lucide-react';

function PageMetadataEditor({
  pageNumber,
  pageMetadata,
  onChangeField,
}: {
  pageNumber: number;
  pageMetadata: APIPage;
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
  allEntries,
  entries,
  file,
  metadata,
  onPagesDeleted,
}: {
  allEntries: Entry[];
  entries: Entry[];
  file: string;
  onPagesDeleted: () => {};
  metadata: APIMetadata;
}) {
  const [renumberDeletes, setRenumberDeletes] = useState(true);
  const [metadataDirty, setMetadataDirty] = useState(false);
  const [currentMetadata, setCurrentMetadata] = useState<APIMetadata>({});
  const [metadataStatus, setMetadataStatus] = useState(ActionState.NONE);
  const [deleteStatus, setDeleteStatus] = useState(ActionState.NONE);
  const [toDelete, setToDelete] = useState<string[]>([]);
  const [currentEntry, setCurrentEntry] = useState<Entry>(entries[0]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [bookmarkImageToAdd, setBookmarkImageToAdd] = useState('');
  const [bookmarkToAdd, setBookmarkToAdd] = useState('');
  const { toast } = useToast();

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
      if (event.key.toLowerCase() === 'd') {
        if (currentEntry) toggleEntryToDelete(currentEntry)();

        event.stopPropagation();
        event.preventDefault();
      }

      if (event.key.toLowerCase() === 'enter') {
        if (toDelete.length > 0 && !deleteOpen) {
          setDeleteOpen(true);
          event.stopPropagation();
          event.preventDefault();
        } else if (metadataDirty) {
          await saveMetadata();
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

  const addBookmark = () => {
    setCurrentMetadata((prevValue) => {
      const newValue = { ...prevValue };
      const imageToAdd = parseInt(bookmarkImageToAdd, 10);

      if (isNaN(imageToAdd) || !bookmarkToAdd) {
        return prevValue;
      }

      if (!newValue.pages) {
        newValue.pages = [];
      }

      const pageEntry = newValue.pages.find((x) => x.image == imageToAdd);
      if (pageEntry) {
        pageEntry.bookmark = bookmarkToAdd;
      } else {
        newValue.pages.push({
          image: imageToAdd,
          bookmark: bookmarkToAdd,
        });

        newValue.pages.sort(
          (a, b) => (a.image as number) - (b.image as number)
        );
      }

      return newValue;
    });
  };

  const removeBookmark = (bookmarkIdx: number) => {
    if (!currentMetadata.pages) return;
    const pageEntry = currentMetadata.pages.find((x) => x.image == bookmarkIdx);
    if (pageEntry) {
      setCurrentMetadata((prevValue) => {
        const newValue = { ...prevValue };
        pageEntry.bookmark = null;
        return newValue;
      });
    }
  };

  const onUpdateMetadata = async (metadata: APIMetadata) => {
    setMetadataStatus(ActionState.INPROGRESS);
    const setData = await API.setMetadata(metadata as Metadata);
    setMetadataStatus(ActionState.NONE);
    toast({
      title: !setData.error ? 'Task Finished' : 'Task Failed',
      variant: !setData.error ? 'default' : 'destructive',
      description: !setData.error
        ? 'Saving page metadata completed.'
        : `Error occured while saving page metadata: ${setData.errorStr}.`,
    });
  };

  useEffect(() => {
    const onlyPages = {
      pages: metadata.pages,
    };
    setToDelete([]);
    setCurrentMetadata(onlyPages);
    setMetadataStatus(ActionState.NONE);
  }, [metadata, entries]);

  const saveMetadata = async () => {
    await onUpdateMetadata(currentMetadata);
    setMetadataDirty(false);
  };

  const deletePages = async () => {
    setDeleteStatus(ActionState.INPROGRESS);
    const entriesToDelete = [...toDelete];
    setToDelete([]);
    const entryMap: EntryMap = {};
    const newPages: Page[] = [];
    let imageIdx = -1;
    let skippedImages = 0;

    for (const entry of allEntries) {
      const shouldDelete = entriesToDelete.find(
        (val) => val === entry.entryName
      );
      const isImage = entries.find((val) => val.entryName === entry.entryName);
      if (isImage) imageIdx++;
      if (shouldDelete) {
        skippedImages++;
        continue;
      }
      if (renumberDeletes && isImage && skippedImages > 0) {
        entryMap[entry.entryName] = changeImageNum(entry, skippedImages);
      } else {
        entryMap[entry.entryName] = entry.entryName;
      }
      if (isImage) {
        const existingPage = currentMetadata.pages?.find(
          (val) => val.image === imageIdx
        );
        if (existingPage && typeof existingPage.image === 'number') {
          const newPage = {
            ...(existingPage as Page),
            ...{ image: existingPage.image - skippedImages },
          };
          newPages.push(newPage);
        }
      }
    }
    const renamedEntries = await API.renameEntries(entryMap);
    if (renamedEntries.error) {
      toast({
        title: 'Task Failed',
        variant: 'destructive',
        description: `Error occured while deleting pages: ${renamedEntries.errorStr}.`,
      });
    } else {
      if (newPages.length > 0) {
        const setData = await API.setMetadata({
          pages: newPages,
        } as Metadata);
        if (setData.error) {
          toast({
            title: 'Task Failed',
            variant: 'destructive',
            description: `Error occured while deleting pages: ${setData.errorStr}.`,
          });
        }
        setMetadataDirty(false);
      }
    }

    setDeleteStatus(ActionState.NONE);
    await onPagesDeleted();
  };

  const renderBookmarkEditor = (index: number) => {
    const pages = currentMetadata.pages || [];
    const bookMarks = pages
      .map((p) => {
        if (p.bookmark) {
          return {
            image: p.image as number,
            name: (entries[p.image as number] || {}).entryName,
            bookmark: p.bookmark as string,
          };
        }
        return null;
      })
      .filter((x) => x != null);

    bookMarks.sort((a, b) => a.image - b.image);

    return (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Page #</TableHead>
              <TableHead>Entry Name</TableHead>
              <TableHead>Bookmark</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookMarks.map((bookmark) => {
              return (
                <TableRow>
                  <TableCell>{bookmark.image}</TableCell>
                  <TableCell>{bookmark.name}</TableCell>
                  <TableCell>{bookmark.bookmark}</TableCell>
                  <TableCell>
                    <Cross1Icon
                      className="cursor-pointer"
                      onClick={() => {
                        removeBookmark(bookmark.image);
                      }}
                    ></Cross1Icon>
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow>
              <TableCell>
                <Input
                  value={bookmarkImageToAdd}
                  onChange={(e) => setBookmarkImageToAdd(e.target.value)}
                ></Input>
              </TableCell>
              <TableCell></TableCell>
              <TableCell>
                <Input
                  value={bookmarkToAdd}
                  onChange={(e) => setBookmarkToAdd(e.target.value)}
                ></Input>
              </TableCell>
              <TableCell>
                <PlusIcon
                  className="cursor-pointer"
                  onClick={addBookmark}
                ></PlusIcon>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <Button className="mt-2" onClick={saveMetadata}>
          {metadataStatus === ActionState.INPROGRESS ? (
            <UpdateIcon className="mr-1 animate-spin" />
          ) : null}{' '}
          Save Bookmarks (And Metadata)
        </Button>
      </>
    );
  };

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

    return (
      <div className="">
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
          <Separator></Separator>
          <p className="text-xs text-muted-foreground">
            Select images to delete with trash icon (or press 'd' on image).
            This also saves in progress metadata.
          </p>
          <div className="flex items-center space-x-2">
            <Switch
              checked={renumberDeletes}
              onCheckedChange={(checked: boolean) => {
                setRenumberDeletes(checked);
              }}
            />
            <Label>Renumber Images On Delete</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="flex items-start">
                  <InfoCircledIcon />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    This will try to renumber the pages according to how many
                    were deleted.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {renderDeleteAlert()}
        </div>
      </div>
    );
  };

  const toggleEntryToDelete = (entry: Entry) => {
    return (event?: React.MouseEvent<HTMLButtonElement>) => {
      // Blur the button so you can still use keyboard shortcuts
      event?.currentTarget.blur();
      setToDelete((prev) => {
        if (prev.find((val) => val === entry.entryName)) {
          return (prev as string[]).filter((item) => item !== entry.entryName);
        }
        return [...(prev ?? []), entry.entryName];
      });
    };
  };

  const renderDeleteAlert = () => {
    return (
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => setDeleteOpen(open)}
      >
        <AlertDialogTrigger>
          <Button
            className="w-full"
            disabled={
              toDelete.length <= 0 || deleteStatus === ActionState.INPROGRESS
            }
            variant={'destructive'}
          >
            {deleteStatus === ActionState.INPROGRESS ? (
              <UpdateIcon className="mr-1 animate-spin" />
            ) : null}{' '}
            Delete {toDelete.length} Marked Images
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              Are you sure you want to delete?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              files selected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deletePages}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  return (
    <ImageList
      entries={entries}
      file={file}
      controls={(index: number) => {
        return (
          <div className="max-h-full h-full grow">
            <ScrollArea className="h-full ">
              <Tabs defaultValue="metadata">
                <TabsList className="ml-4">
                  <TabsTrigger value="metadata">Metadata</TabsTrigger>
                  <TabsTrigger value="bookmarks">Bookmarks</TabsTrigger>
                </TabsList>
                <TabsContent value="metadata" className="pl-4 pr-4">
                  {renderMetadataEditor(index)}
                </TabsContent>
                <TabsContent value="bookmarks" className="pl-4 pr-4">
                  {renderBookmarkEditor(index)}
                </TabsContent>
              </Tabs>
            </ScrollArea>
          </div>
        );
      }}
      imageControls={(index: number) => {
        const entry = entries[index];
        const markedDeleted = toDelete.find((val) => val === entry.entryName);
        return (
          <div className="absolute top-1 right-1">
            <Button
              className="p-0 w-[30px] h-[30px] opacity-70"
              onClick={toggleEntryToDelete(entry)}
              variant={markedDeleted ? 'secondary' : 'default'}
            >
              {markedDeleted ? <ResetIcon /> : <TrashIcon />}
            </Button>
          </div>
        );
      }}
      onPageChange={(entry) => {
        setCurrentEntry(entry);
      }}
    ></ImageList>
  );
}

export default PageMetadata;
