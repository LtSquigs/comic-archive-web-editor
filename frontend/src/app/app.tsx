import { useEffect, useState } from 'react';
import { API } from './api';
import FileList from './fileList';
import MetadataEditor from './metadata';
import EntriesEditor from './entries';
import { FileTree, Entry, Metadata, ActionState } from './types';
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

export function App() {
  const [files, setFiles] = useState<FileTree>({});
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<Metadata>({});
  const [entries, setEntries] = useState<Entry[]>([]);
  const [deleteStatus, setDeleteStatus] = useState(ActionState.NONE);
  const [selectedTab, setSelectedTab] = useState('metadata');
  const [loading, setLoading] = useState(ActionState.NONE);

  useEffect(() => {
    (async () => {
      const files = await API.getAllCBZ();
      setFiles(files);
    })();
  }, []);

  useEffect(() => {
    API.setFiles(selectedFiles);
  }, [selectedFiles]);

  useEffect(() => {
    setDeleteStatus(ActionState.NONE);
    setSelectedFiles([]);
    setEntries([]);
    setMetadata({});
  }, [files]);

  useEffect(() => {
    (async () => {
      setLoading(ActionState.INPROGRESS);

      const entries = await API.getEntries();
      setEntries(entries);
      const metadata = await API.getMetadata();
      setMetadata(metadata);

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
    const entries = await API.getEntries();
    setEntries(entries);
  };

  const refreshFiles = async () => {
    const files = await API.getAllCBZ();
    setFiles(files);
  };

  const onDelete = async () => {
    setDeleteStatus(ActionState.INPROGRESS);
    const success = await API.delete();
    setDeleteStatus(success ? ActionState.SUCCESS : ActionState.FAILED);
    await refreshFiles();
  };

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={20}>
        <ScrollArea className="h-[100vh] rounded-md  p-4">
          <FileList files={files} onUpdateSelected={handleUpdateSelected} />
        </ScrollArea>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel>
        <div className="h-[100vh] p-4 grow relative">
          {selectedFiles.length > 0 ? (
            <>
              <Tabs
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
                </TabsList>
                <TabsContent value="metadata">
                  {loading === ActionState.INPROGRESS ? (
                    <Skeleton className="w-[400px] h-[30px]" />
                  ) : (
                    <ScrollArea
                      style={{ height: 'calc(100vh - 40px - 2.5rem)' }}
                    >
                      <MetadataEditor
                        entries={entries.filter(
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
                      entries={entries.filter(
                        (entry) => entry.isImage && !entry.isCover
                      )}
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
                      entries={entries.filter(
                        (entry) => entry.isImage && !entry.isCover
                      )}
                      file={selectedFiles[0]}
                    />
                  )}
                </TabsContent>
                <TabsContent value="splitter">
                  {loading === ActionState.INPROGRESS ? (
                    <Skeleton className="w-[400px] h-[30px]" />
                  ) : (
                    <ArchiveSplitter
                      entries={entries.filter(
                        (entry) => entry.isImage && !entry.isCover
                      )}
                      file={selectedFiles[0]}
                      onSplit={refreshFiles}
                    ></ArchiveSplitter>
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
