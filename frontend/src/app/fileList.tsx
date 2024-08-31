import {
  forwardRef,
  ReactElement,
  useEffect,
  useImperativeHandle,
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
  const { data: files, error, errorStr } = await API.getCBZFiles(dir);
  const tree = files.map((file): FileTree => {
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
  for (let tree of trees) {
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
    onUpdateSelected,
  }: {
    initialSelectedId: string | undefined;
    onUpdateSelected: (ids: string[]) => void;
  },
  ref
) {
  const [files, setFiles] = useState<FileTree[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const { toast } = useToast();
  useImperativeHandle(
    ref,
    () => {
      return {
        refresh: async () => {
          await refreshItems();
        },
      };
    },
    [expandedFolders]
  );

  useEffect(() => {
    (async () => {
      const items = await getFileTree();
      setFiles(items);
    })();
  }, []);

  const refreshItems = async function () {
    setRefreshing(true);

    const items = await getFileTree();
    const loadedItems = [];
    for (let item of items) {
      if (expandedFolders.includes(item.id)) {
        const loadedItem = await loadSubfolders(item.id, items);
        loadedItems.push(loadedItem ?? item);
      } else {
        loadedItems.push(item);
      }
    }

    setFiles(loadedItems);
    setRefreshing(false);

    toast({
      title: 'Task Finished',
      variant: 'default',
      description: 'Successfully reloaded file list.',
    });
  };

  const loadSubfolders = async (
    dir: string,
    folders: FileTree[]
  ): Promise<FileTree | null> => {
    const foundTree = findTree(dir, folders);
    if (foundTree) {
      const items = await getFileTree(dir);
      const loadedItems = [];
      for (let child of items) {
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

    for (let tree of elements) {
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
      }
    }

    selectGroups.push(group);

    return treeElements;
  };

  return (
    <div>
      <h6 className="text-xl font-semibold mb-2 flex items-center">
        CBZ Files{' '}
        {refreshing ? (
          <ReloadIcon className="ml-2 cursor-pointer animate-spin"></ReloadIcon>
        ) : (
          <ReloadIcon
            className="ml-2 cursor-pointer"
            onClick={refreshItems}
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
