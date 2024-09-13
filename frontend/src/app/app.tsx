import { ReactElement, useEffect, useRef, useState } from 'react';
import { API } from './api';

/* types */
import { ActionState, SplitMarker } from './types';
import { Entry, APIMetadata } from '../shared/types';

/* components */
import FileList from './fileList';
import MetadataEditor from './metadata';
import EntriesEditor from './entries';
import JoinPages from './joinPages';
import PageMetadata from './pageMetadata';
import ArchiveSplitter from './archiveSplitter';
import BulkMetadata from './bulkMetadata';

/* shad-cn components */
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import DeleteButton from './deleteButton';

export function App() {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<APIMetadata>({});
  const [entries, setEntries] = useState<Entry[]>([]);
  const [imageEntries, setImageEntiries] = useState<Entry[]>([]);
  const [defaultSelectedFile, setDefaultSelectedFile] = useState<
    string | undefined
  >(undefined);

  const [selectedTab, setSelectedTab] = useState('metadata');
  const [loading, setLoading] = useState(ActionState.NONE);

  const fileRef = useRef<any>(null);
  const { toast } = useToast();

  const tabs = ['metadata', 'entries', 'page', 'join', 'splitter', 'bulk'];

  useEffect(() => {
    const handleKeyPress = async (event: KeyboardEvent) => {
      if (!event.shiftKey) {
        return;
      }
      if (['INPUT', 'BUTTON'].includes((event.target as HTMLElement).tagName)) {
        return;
      }
      const idx = tabs.findIndex((val) => val === selectedTab);
      if (event.key === 'ArrowRight') {
        setSelectedTab(idx + 1 < tabs.length ? tabs[idx + 1] : tabs[0]);
        event.stopPropagation();
        event.preventDefault();
      }
      if (event.key === 'ArrowLeft') {
        setSelectedTab(idx - 1 >= 0 ? tabs[idx - 1] : tabs[tabs.length - 1]);
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
    API.setFiles(selectedFiles);
  }, [selectedFiles]);

  useEffect(() => {
    (async () => {
      setLoading(ActionState.INPROGRESS);

      const entries = await API.getEntries();
      if (entries.error) {
        if (!entries.aborted) {
          toast({
            title: 'Task Failed',
            variant: 'destructive',
            description: `Unable to load entries. Recieved Error ${entries.errorStr}`,
          });
        }
        setLoading(ActionState.NONE);
        return;
      }

      setEntries(entries.data);
      setImageEntiries(
        (entries.data || []).filter((entry) => entry.isImage && !entry.isCover)
      );

      const metadata = await API.getMetadata();
      if (metadata.error) {
        if (!metadata.aborted) {
          toast({
            title: 'Task Failed',
            variant: 'destructive',
            description: `Unable to load metadata. Recieved Error ${metadata.errorStr}`,
          });
        }
        setLoading(ActionState.NONE);
        return;
      }

      setMetadata(metadata.data);

      setLoading(ActionState.NONE);
    })();
  }, [selectedFiles, selectedTab]);

  const handleUpdateSelected = (ids: string[]) => {
    // If the selected files have not actually changed, we don't update
    // the state and risk triggering a re-render
    if (
      ids.length === selectedFiles.length &&
      ids.every((value, index) => value === selectedFiles[index])
    ) {
      return;
    }
    setSelectedFiles(ids);

    if (ids.length === 1) setDefaultSelectedFile(ids[0]);
  };

  const refreshEntries = async () => {
    const entries = await API.getEntries();
    if (entries.error) {
      if (!entries.aborted)
        toast({
          title: 'Task Failed',
          variant: 'destructive',
          description: `Unable to refresh entries. Recieved Error ${entries.errorStr}`,
        });
      return;
    }
    setEntries(entries.data);
    setImageEntiries(
      (entries.data || []).filter((entry) => entry.isImage && !entry.isCover)
    );
  };

  const refreshMetadata = async () => {
    const metadata = await API.getMetadata();
    if (metadata.error) {
      if (!metadata.aborted) {
        toast({
          title: 'Task Failed',
          variant: 'destructive',
          description: `Unable to refresh metadata. Recieved Error ${metadata.errorStr}`,
        });
      }
      return;
    }
    setMetadata(metadata.data);
  };

  const refreshFiles = async (
    selectedFile: string | undefined = undefined,
    noRedirect?: boolean
  ) => {
    if (fileRef.current) await fileRef.current.refresh();
    if (!noRedirect) {
      setSelectedFiles(selectedFile ? [selectedFile] : []);
      setDefaultSelectedFile(selectedFile);
      setSelectedTab('metadata');
      setEntries([]);
      setMetadata({});
    }
  };

  const renderLoading = (component: ReactElement) => {
    if (loading === ActionState.INPROGRESS) {
      return <Skeleton className="w-[400px] h-[30px]" />;
    }
    return component;
  };

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={20}>
        <ScrollArea className="h-[100vh] rounded-md  p-4">
          <FileList
            initialSelectedId={defaultSelectedFile}
            selectedIds={selectedFiles}
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
                onValueChange={(value: string) => {
                  setSelectedTab(value);
                }}
              >
                <TabsList>
                  <TabsTrigger
                    value="metadata"
                    onClick={(event) => event.currentTarget.blur()}
                  >
                    Metadata
                  </TabsTrigger>
                  <TabsTrigger
                    value="entries"
                    onClick={(event) => event.currentTarget.blur()}
                  >
                    Entries
                  </TabsTrigger>
                  <TabsTrigger
                    value="page"
                    disabled={selectedFiles.length > 1}
                    onClick={(event) => event.currentTarget.blur()}
                  >
                    Page Metadata
                  </TabsTrigger>
                  <TabsTrigger
                    value="join"
                    disabled={selectedFiles.length > 1}
                    onClick={(event) => event.currentTarget.blur()}
                  >
                    Join Pages
                  </TabsTrigger>
                  <TabsTrigger
                    value="splitter"
                    disabled={selectedFiles.length > 1}
                    onClick={(event) => event.currentTarget.blur()}
                  >
                    Archive Splitter
                  </TabsTrigger>
                  <TabsTrigger
                    value="bulk"
                    disabled={selectedFiles.length < 1}
                    onClick={(event) => event.currentTarget.blur()}
                  >
                    Bulk Metadata
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="metadata">
                  {renderLoading(
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
                  {renderLoading(
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
                  {renderLoading(
                    <PageMetadata
                      allEntries={entries}
                      entries={imageEntries}
                      file={selectedFiles[0]}
                      metadata={metadata}
                      onPagesDeleted={async () => {
                        await refreshEntries();
                        await refreshMetadata();
                      }}
                    />
                  )}
                </TabsContent>
                <TabsContent value="join">
                  {renderLoading(
                    <JoinPages
                      entries={imageEntries}
                      file={selectedFiles[0]}
                      onJoin={refreshEntries}
                    />
                  )}
                </TabsContent>
                <TabsContent value="splitter">
                  {renderLoading(
                    <ArchiveSplitter
                      entries={imageEntries}
                      file={selectedFiles[0]}
                      onSplit={async (
                        splits: SplitMarker[],
                        noRedirect: boolean
                      ) => {
                        await refreshFiles(splits[0].filename, noRedirect);
                      }}
                    ></ArchiveSplitter>
                  )}
                </TabsContent>
                <TabsContent value="bulk" className="h-full">
                  {renderLoading(
                    <BulkMetadata files={selectedFiles}></BulkMetadata>
                  )}
                </TabsContent>
              </Tabs>
              <div className="absolute top-4 right-4">
                <DeleteButton
                  onDelete={async () => {
                    await refreshFiles();
                  }}
                />
              </div>
            </>
          ) : null}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export default App;
