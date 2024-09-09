import { useEffect, useState } from 'react';
import { ActionState } from './types';

import {
  TriangleDownIcon,
  TriangleRightIcon,
  UpdateIcon,
} from '@radix-ui/react-icons';
import { API } from './api';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { APIMetadata } from '@/shared/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import ScraperResult from './scraperResult';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export function MetadataScraper({
  fullMetadata,
  onUpdateMetadata,
}: {
  fullMetadata: APIMetadata;
  onUpdateMetadata: (metadata: APIMetadata) => void;
}) {
  const [keysOpen, setKeysOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [comicvineKey, setComicvineKey] = useState('');
  const [myanimelistKey, setMyanimelistKey] = useState('');
  const [keysSaving, setKeysSaving] = useState(ActionState.NONE);
  const [scraping, setScraping] = useState(ActionState.NONE);
  const [results, setResults] = useState<APIMetadata | null>(null);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const result = await API.getKeys();
      if (result.error) {
        toast({
          title: 'Failed to load API Keys',
          variant: 'destructive',
          description: `Error occured while fetching keys: ${result.errorStr}.`,
        });
        return;
      }

      setComicvineKey(result.data.comicvine || '');
      setMyanimelistKey(result.data.myanimelist || '');
    })();
  }, []);

  const saveKey = async () => {
    setKeysSaving(ActionState.INPROGRESS);
    const result = await API.setKeys({
      comicvine: comicvineKey,
      myanimelist: myanimelistKey,
    });
    setKeysSaving(ActionState.NONE);
    if (result.error) {
      toast({
        title: 'Failed to save API Keys',
        variant: 'destructive',
        description: `Error occured while saving keys: ${result.errorStr}.`,
      });
      return;
    }

    toast({
      title: 'Successfully saved API Keys',
      variant: 'default',
      description: `Successfully saved keys.`,
    });
  };

  const scrape = async () => {
    setScraping(ActionState.INPROGRESS);
    const resp = await API.scrape(url);

    if (resp.error) {
      toast({
        title: 'Error Scraping Data',
        variant: 'destructive',
        description: `Recieved Error: ${resp.errorStr}.`,
      });
    } else {
      const metadata: APIMetadata = {};
      for (const [key, value] of Object.entries(resp.data)) {
        if (value !== null && value !== undefined) {
          (metadata as any)[key] = value;
        }
      }
      setResults(metadata);
    }
    setScraping(ActionState.NONE);
  };

  const mergeMetadata = (newMetadata: APIMetadata) => {
    const mergedMetadata = { ...fullMetadata };
    for (const [key, value] of Object.entries(newMetadata)) {
      let typedKey = key as keyof APIMetadata;
      (mergedMetadata as any)[typedKey] = newMetadata[typedKey];
    }
    onUpdateMetadata(mergedMetadata);
    setOpen(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={() => {
        setOpen((prevValue) => !prevValue);
        setUrl('');
        setResults(null);
      }}
    >
      <SheetTrigger className="w-full">
        <Button className="w-full">Scrape Metadata</Button>
      </SheetTrigger>
      <SheetContent className="p-0">
        <ScrollArea className="h-full">
          <SheetHeader className="p-6">
            <SheetTitle>Scrape Metadata From External Site</SheetTitle>
            <SheetDescription>
              <Collapsible
                onOpenChange={(open) => {
                  setKeysOpen(open);
                }}
              >
                <CollapsibleTrigger>
                  <div className="flex items-center">
                    {keysOpen ? (
                      <TriangleDownIcon
                        width={25}
                        height={25}
                      ></TriangleDownIcon>
                    ) : (
                      <TriangleRightIcon
                        width={25}
                        height={25}
                      ></TriangleRightIcon>
                    )}
                    Change API Keys
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Label className="mt-2">Comic Vine API Key</Label>
                  <div className="mt-2 mb-2 flex">
                    <div className="flex-grow">
                      <Input
                        value={comicvineKey}
                        onChange={(event) =>
                          setComicvineKey(event.target.value)
                        }
                      ></Input>
                    </div>
                    <div className="ml-2">
                      <Button onClick={saveKey}>
                        {keysSaving === ActionState.INPROGRESS ? (
                          <UpdateIcon className="mr-1 animate-spin" />
                        ) : null}{' '}
                        Save
                      </Button>
                    </div>
                  </div>
                  <Label>MyAnimeList Client Key</Label>
                  <div className="mt-2 mb-2 flex">
                    <div className="flex-grow">
                      <Input
                        value={myanimelistKey}
                        onChange={(event) =>
                          setMyanimelistKey(event.target.value)
                        }
                      ></Input>
                    </div>
                    <div className="ml-2">
                      <Button onClick={saveKey}>
                        {keysSaving === ActionState.INPROGRESS ? (
                          <UpdateIcon className="mr-1 animate-spin" />
                        ) : null}{' '}
                        Save
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
              <div className="mt-2">
                <Label>URL</Label>
                <div className="mt-2 mb-2 flex">
                  <div className="flex-grow">
                    <Input
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                    ></Input>
                  </div>
                  <div className="ml-2">
                    <Button onClick={scrape}>
                      {scraping === ActionState.INPROGRESS ? (
                        <UpdateIcon className="mr-1 animate-spin" />
                      ) : null}{' '}
                      Scrape
                    </Button>
                  </div>
                </div>
              </div>
              {results !== null ? (
                <div className="mt-2">
                  <ScraperResult
                    metadata={results}
                    onMerge={mergeMetadata}
                  ></ScraperResult>
                </div>
              ) : null}
            </SheetDescription>
          </SheetHeader>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default MetadataScraper;
