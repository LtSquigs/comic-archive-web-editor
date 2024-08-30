import { ReactElement } from 'react';
import { FileTree } from './types';
import { Tree, Folder, File } from '@/components/extension/tree-view-api';

type FileListProps = {
  files: FileTree;
  onUpdateSelected: (ids: string[]) => void;
};

export function FileList({
  files = {},
  onUpdateSelected = (_ids: string[]) => {},
}: FileListProps) {
  const updateSelected = (ids: string | string[] | undefined) => {
    ids = ids ?? [];
    if (typeof ids === 'string') {
      ids = [ids];
    }

    onUpdateSelected(ids);
  };

  const selectGroups: string[][] = [];

  const renderTree = (elements: FileTree, folder: string): ReactElement[] => {
    const treeElements = [] as ReactElement[];
    const fileKeys = Object.keys(elements);

    fileKeys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const group = [];

    for (let key of fileKeys) {
      const obj = elements[key];
      if (typeof obj === 'object' && obj.name && typeof obj.name === 'string') {
        treeElements.push(
          <File value={obj.name}>
            <span>{key}</span>
          </File>
        );
        group.push(obj.name);
      } else if (typeof obj === 'object') {
        const folderElements = renderTree(
          obj,
          [folder, key].filter((x) => x).join('-')
        );
        treeElements.push(
          <Folder
            element={key}
            value={[folder, key].filter((x) => x).join('-')}
          >
            {folderElements}
          </Folder>
        );
      }
    }

    selectGroups.push(group);

    return treeElements;
  };

  return (
    <div>
      <h6 className="text-xl font-semibold mb-2">CBZ Files</h6>
      <Tree
        multiSelect
        onValueChange={updateSelected}
        selectGroups={selectGroups}
      >
        {renderTree(files, '')}
      </Tree>
    </div>
  );
}

export default FileList;
