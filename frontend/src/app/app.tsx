import { useEffect, useRef, useState } from 'react';
import { API } from './api';
import FileList from './fileList';
import MetadataEditor from './metadata';
import EntriesEditor from './entries';
import { ActionState, SplitMarker } from './types';
import { Entry, APIMetadata } from '../shared/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import JoinPages from './joinPages';
import PageMetadata from './pageMetadata';
import ArchiveSplitter from './archiveSplitter';
import { Button } from '@/components/ui/button';
import { UpdateIcon } from '@radix-ui/react-icons';
import BulkMetadata from './bulkMetadata';
import { useToast } from '@/hooks/use-toast';

export function App() {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<APIMetadata>({});
  const [entries, setEntries] = useState<Entry[]>([]);
  const [imageEntries, setImageEntiries] = useState<Entry[]>([]);
  const [deleteStatus, setDeleteStatus] = useState(ActionState.NONE);
  const [selectedTab, setSelectedTab] = useState('metadata');
  const [loading, setLoading] = useState(ActionState.NONE);
  const [defaultSelectedFile, setDefaultSelectedFile] = useState<
    string | undefined
  >(undefined);
  const fileRef = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    API.setFiles(selectedFiles);
  }, [selectedFiles]);

  useEffect(() => {
    setImageEntiries(
      (entries || []).filter((entry) => entry.isImage && !entry.isCover)
    );
  }, [entries]);

  useEffect(() => {
    (async () => {
      setLoading(ActionState.INPROGRESS);

      const { data, error, errorStr } = await API.getEntries();
      if (error) {
        toast({
          title: 'Task Failed',
          variant: 'destructive',
          description: `Unable to load entries. Recieved Error ${errorStr}`,
        });
        setLoading(ActionState.NONE);
        return;
      }
      setEntries(data);

      const {
        data: mData,
        error: mError,
        errorStr: mErrorStr,
      } = await API.getMetadata();
      if (mError) {
        toast({
          title: 'Task Failed',
          variant: 'destructive',
          description: `Unable to load metadata. Recieved Error ${mErrorStr}`,
        });
        setLoading(ActionState.NONE);
        return;
      }
      setMetadata(mData);

      setLoading(ActionState.NONE);
    })();
  }, [selectedFiles, selectedTab]);

  useEffect(() => {
    setSelectedTab('metadata');
  }, [selectedFiles]);

  const handleUpdateSelected = (ids: string[]) => {
    setSelectedFiles(ids);
  };

  const refreshEntries = async () => {
    const { data: entries, error, errorStr } = await API.getEntries();
    if (error) {
      toast({
        title: 'Task Failed',
        variant: 'destructive',
        description: `Unable to refresh entries. Recieved Error ${errorStr}`,
      });
    }
    setEntries(entries);
  };

  const refreshFiles = async (selectedFile: string | undefined = undefined) => {
    if (fileRef.current) await (fileRef.current as any).refresh();
    setDeleteStatus(ActionState.NONE);
    setSelectedFiles(selectedFile ? [selectedFile] : []);
    setDefaultSelectedFile(selectedFile);
    setEntries([]);
    setMetadata({});
  };

  const onDelete = async () => {
    setDeleteStatus(ActionState.INPROGRESS);
    const { data: success, error, errorStr } = await API.delete();

    toast({
      title: success && !error ? 'Task Finished' : 'Task Failed',
      variant: success && !error ? 'default' : 'destructive',
      description:
        success && !error
          ? 'Deleting archive completed.'
          : `Error occured while deleting archive: ${errorStr}.`,
    });

    setDeleteStatus(ActionState.NONE);
    await refreshFiles();
  };

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={20}>
        <ScrollArea className="h-[100vh] rounded-md  p-4">
          <FileList
            initialSelectedId={defaultSelectedFile}
            onUpdateSelected={handleUpdateSelected}
            ref={fileRef}
          />
        </ScrollArea>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel>
        <div className="h-[100vh] p-4 grow relative">
          {selectedFiles.length > 0 ? (
            <>
              <Tabs
                className={selectedTab === 'bulk' ? 'h-full' : ''}
                value={selectedTab}
                onValueChange={(value: any) => {
                  setSelectedTab(value);
                }}
              >
                <TabsList>
                  <TabsTrigger value="metadata">Metadata</TabsTrigger>
                  <TabsTrigger value="entries">Entries</TabsTrigger>
                  <TabsTrigger value="page" disabled={selectedFiles.length > 1}>
                    Page Metadata
                  </TabsTrigger>
                  <TabsTrigger value="join" disabled={selectedFiles.length > 1}>
                    Join Pages
                  </TabsTrigger>
                  <TabsTrigger
                    value="splitter"
                    disabled={selectedFiles.length > 1}
                  >
                    Archive Splitter
                  </TabsTrigger>
                  <TabsTrigger value="bulk" disabled={selectedFiles.length < 1}>
                    Bulk Metadata
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="metadata">
                  {loading === ActionState.INPROGRESS ? (
                    <Skeleton className="w-[400px] h-[30px]" />
                  ) : (
                    <ScrollArea
                      style={{ height: 'calc(100vh - 40px - 2.5rem)' }}
                    >
                      <MetadataEditor
                        entries={(entries || []).filter(
                          (entry) => entry.isImage && !entry.isCover
                        )}
                        metadata={metadata}
                        files={selectedFiles}
                      />
                    </ScrollArea>
                  )}
                </TabsContent>
                <TabsContent value="entries" className="h-full">
                  {loading === ActionState.INPROGRESS ? (
                    <Skeleton className="w-[400px] h-[30px]" />
                  ) : (
                    <ScrollArea
                      style={{ height: 'calc(100vh - 40px - 2.5rem)' }}
                    >
                      <EntriesEditor
                        entries={entries}
                        onEntriesChanged={refreshEntries}
                      />
                    </ScrollArea>
                  )}
                </TabsContent>
                <TabsContent value="page">
                  {loading === ActionState.INPROGRESS ? (
                    <Skeleton className="w-[400px] h-[30px]" />
                  ) : (
                    <PageMetadata
                      entries={imageEntries}
                      file={selectedFiles[0]}
                      metadata={metadata}
                    />
                  )}
                </TabsContent>
                <TabsContent value="join">
                  {loading === ActionState.INPROGRESS ? (
                    <Skeleton className="w-[400px] h-[30px]" />
                  ) : (
                    <JoinPages
                      entries={imageEntries}
                      file={selectedFiles[0]}
                      onJoin={refreshEntries}
                    />
                  )}
                </TabsContent>
                <TabsContent value="splitter">
                  {loading === ActionState.INPROGRESS ? (
                    <Skeleton className="w-[400px] h-[30px]" />
                  ) : (
                    <ArchiveSplitter
                      entries={imageEntries}
                      file={selectedFiles[0]}
                      onSplit={async (splits: SplitMarker[]) => {
                        await refreshFiles(splits[0].filename);
                      }}
                    ></ArchiveSplitter>
                  )}
                </TabsContent>
                <TabsContent value="bulk" className="h-full">
                  {loading === ActionState.INPROGRESS ? (
                    <Skeleton className="w-[400px] h-[30px]" />
                  ) : (
                    <BulkMetadata files={selectedFiles}></BulkMetadata>
                  )}
                </TabsContent>
              </Tabs>
              <Button
                variant={'destructive'}
                className="absolute top-4 right-4"
                onClick={() => {
                  onDelete();
                }}
              >
                {deleteStatus === ActionState.INPROGRESS ? (
                  <UpdateIcon className="mr-1 animate-spin" />
                ) : null}{' '}
                Delete Archive
              </Button>
            </>
          ) : null}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export default App;
