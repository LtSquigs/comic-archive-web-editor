import {
  forwardRef,
  ReactElement,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Tree, Folder, File } from '@/components/extension/tree-view-api';
import { API } from './api';
import { ReloadIcon } from '@radix-ui/react-icons';
import { useToast } from '@/hooks/use-toast';

type FileTree = {
  id: string;
  parent: string;
  name: string;
  hasChildren: boolean;
  children: FileTree[];
};

const getFileTree = async (dir: string = '') => {
  const files = await API.getArchiveFiles(dir);
  if (files.error) {
    return [];
  }
  const tree = files.data.map((file): FileTree => {
    return {
      id: file.path,
      parent: file.parentPath,
      name: file.name,
      hasChildren: file.directory,
      children: [],
    };
  });

  tree.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true })
  );

  return tree;
};

const findTree = (id: string, trees: FileTree[]): FileTree | null => {
  for (const tree of trees) {
    if (tree.id === id) {
      return tree;
    }

    const found = findTree(id, tree.children);
    if (found) return found;
  }

  return null;
};

export const FileList = forwardRef(function FileList(
  {
    initialSelectedId,
    selectedIds,
    onUpdateSelected,
  }: {
    initialSelectedId: string | undefined;
    selectedIds: string[];
    onUpdateSelected: (ids: string[]) => void;
  },
  ref
) {
  const [files, setFiles] = useState<FileTree[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const fileList = useRef([] as string[]);
  const { toast } = useToast();
  useImperativeHandle(
    ref,
    () => {
      return {
        refresh: async () => {
          await refreshItems(false);
        },
      };
    },
    [expandedFolders]
  );

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
      if (selectedIds.length === 0) {
        return;
      }
      const lastSelected = selectedIds[selectedIds.length - 1];
      const idx = fileList.current.findIndex((val) => val === lastSelected);
      if (idx === -1) {
        return;
      }
      if (event.key === 'ArrowDown') {
        if (idx === fileList.current.length - 1) {
          return;
        }
        await onUpdateSelected([fileList.current[idx + 1]]);
        event.stopPropagation();
        event.preventDefault();
      }
      if (event.key === 'ArrowUp') {
        if (idx === 0) {
          return;
        }
        await onUpdateSelected([fileList.current[idx - 1]]);
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
    (async () => {
      const items = await getFileTree();
      setFiles(items);
    })();
  }, []);

  const refreshItems = async function (notif: boolean = true) {
    setRefreshing(true);

    const items = await getFileTree();
    const loadedItems = [];
    for (const item of items) {
      if (expandedFolders.includes(item.id)) {
        const loadedItem = await loadSubfolders(item.id, items);
        loadedItems.push(loadedItem ?? item);
      } else {
        loadedItems.push(item);
      }
    }

    setFiles(loadedItems);
    setRefreshing(false);

    if (notif) {
      toast({
        title: 'Task Finished',
        variant: 'default',
        description: 'Successfully reloaded file list.',
      });
    }
  };

  const loadSubfolders = async (
    dir: string,
    folders: FileTree[]
  ): Promise<FileTree | null> => {
    const foundTree = findTree(dir, folders);
    if (foundTree) {
      const items = await getFileTree(dir);
      const loadedItems = [];
      for (const child of items) {
        if (expandedFolders.includes(child.id)) {
          loadedItems.push((await loadSubfolders(child.id, items)) ?? child);
        } else {
          loadedItems.push(child);
        }
      }

      foundTree.children = loadedItems;
    }

    return foundTree;
  };

  const onFolderClose = async (dir: string) => {
    if (!expandedFolders.includes(dir)) {
      return;
    }
    setExpandedFolders((prevValue) => {
      return prevValue.filter((item) => item !== dir);
    });

    setFiles((preValue) => {
      const clone = [...preValue];
      const foundTree = findTree(dir, clone);

      if (foundTree) foundTree.children = [];

      return clone;
    });
  };

  const onFolderOpen = async (dir: string) => {
    if (expandedFolders.includes(dir)) {
      return;
    }
    setExpandedFolders((prevValue) => {
      return [...prevValue, dir].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      );
    });
    const loadedDir = await loadSubfolders(dir, files);
    setFiles((preValue) => {
      const clone = [...preValue];
      const foundTree = findTree(dir, clone);

      if (foundTree) foundTree.children = loadedDir?.children ?? [];

      return clone;
    });
  };

  const updateSelected = (ids: string | string[] | undefined) => {
    ids = ids ?? [];
    if (typeof ids === 'string') {
      ids = [ids];
    }

    onUpdateSelected(ids);
  };

  const selectGroups: string[][] = [];

  const renderTree = (
    elements: FileTree[],
    parentExpanded = false,
    parentId = ''
  ): ReactElement[] => {
    const treeElements = [] as ReactElement[];

    if (parentExpanded && elements.length === 0) {
      return [
        <File isSelectable={false} value={parentExpanded + '-emptyFolder'}>
          <span>
            <i>- No archives found in folder -</i>
          </span>
        </File>,
      ];
    }

    if (elements.length === 0) {
      return [];
    }

    const group = [];

    for (const tree of elements) {
      if (tree.hasChildren) {
        let folderElements = null;
        let expanded = expandedFolders.includes(tree.id);
        folderElements = renderTree(tree.children, expanded, tree.id);

        treeElements.push(
          <Folder element={tree.name} value={tree.id}>
            {folderElements}
          </Folder>
        );
      } else {
        treeElements.push(
          <File value={tree.id}>
            <span>{tree.name}</span>
          </File>
        );
        group.push(tree.id);
        fileList.current.push(tree.id);
      }
    }

    selectGroups.push(group);

    return treeElements;
  };

  fileList.current = [];
  return (
    <div>
      <h6 className="text-xl font-semibold mb-2 flex items-center">
        Archive Files{' '}
        {refreshing ? (
          <ReloadIcon className="ml-2 cursor-pointer animate-spin"></ReloadIcon>
        ) : (
          <ReloadIcon
            className="ml-2 cursor-pointer"
            onClick={async () => {
              await refreshItems();
            }}
          ></ReloadIcon>
        )}
      </h6>
      <Tree
        multiSelect
        initialSelectedId={initialSelectedId}
        onValueChange={updateSelected}
        onToggleClose={onFolderClose}
        onToggleOpen={onFolderOpen}
        selectGroups={selectGroups}
      >
        {renderTree(files)}
      </Tree>
    </div>
  );
});

export default FileList;
