'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { FileIcon, FolderIcon, FolderOpenIcon } from 'lucide-react';
import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';

type TreeViewElement = {
  id: string;
  name: string;
  isSelectable?: boolean;
  children?: TreeViewElement[];
};

type TreeContextProps = {
  selectedId: string | string[] | undefined;
  expendedItems: string[] | undefined;
  indicator: boolean;
  handleExpand: (id: string) => void;
  selectItem: (
    id: string,
    event: React.MouseEvent<HTMLButtonElement, MouseEvent>
  ) => void;
  setExpendedItems?: React.Dispatch<React.SetStateAction<string[] | undefined>>;
  openIcon?: React.ReactNode;
  closeIcon?: React.ReactNode;
  direction: 'rtl' | 'ltr';
};

const TreeContext = createContext<TreeContextProps | null>(null);

const useTree = () => {
  const context = useContext(TreeContext);
  if (!context) {
    throw new Error('useTree must be used within a TreeProvider');
  }
  return context;
};

interface TreeViewComponentProps extends React.HTMLAttributes<HTMLDivElement> {}

type Direction = 'rtl' | 'ltr' | undefined;

type TreeViewProps = {
  initialSelectedId?: string;
  indicator?: boolean;
  elements?: TreeViewElement[];
  initialExpendedItems?: string[];
  openIcon?: React.ReactNode;
  closeIcon?: React.ReactNode;
  multiSelect?: boolean;
  selectGroups?: string[][];
  onValueChange?: (value: string | string[] | undefined) => void;
} & TreeViewComponentProps;

const Tree = forwardRef<HTMLDivElement, TreeViewProps>(
  (
    {
      className,
      elements,
      initialSelectedId,
      initialExpendedItems,
      multiSelect,
      children,
      indicator = true,
      openIcon,
      closeIcon,
      onValueChange,
      dir,
      selectGroups,
      ...props
    },
    ref
  ) => {
    const [lastSelectedId, setLastSelectedId] = useState<string | undefined>();
    const [selectedId, setSelectedId] = useState<string | string[] | undefined>(
      multiSelect
        ? initialSelectedId
          ? [initialSelectedId]
          : []
        : initialSelectedId
    );
    const [expendedItems, setExpendedItems] = useState<string[] | undefined>(
      initialExpendedItems
    );

    const selectItem = useCallback(
      (id: string, event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        if (multiSelect) {
          if (event.shiftKey || event.ctrlKey || event.metaKey) {
            setSelectedId((prev) => {
              if (prev?.includes(id)) {
                setLastSelectedId(undefined);
                return (prev as string[]).filter((item) => item !== id);
              }

              // If shift, and we are adding, check selectGroups to get more than one
              let newSelectedIds = [] as string[];
              if (event.shiftKey && lastSelectedId && selectGroups) {
                let groupIds = prev?.includes(id) ? [] : [id];
                for (let group of selectGroups) {
                  if (group.includes(id) && group.includes(lastSelectedId)) {
                    let inBlock = false;
                    for (let entry of group) {
                      if (entry === id || entry === lastSelectedId) {
                        inBlock = !inBlock;
                      }

                      if (prev?.includes(entry) || groupIds.includes(entry)) {
                        continue;
                      }

                      if (inBlock) {
                        groupIds.push(entry);
                      }
                    }
                  }
                }

                newSelectedIds = [...(prev ?? []), ...groupIds];
              } else {
                newSelectedIds = [...(prev ?? []), id];
              }

              setLastSelectedId(id);
              return newSelectedIds;
            });
          } else {
            setLastSelectedId(id);
            setSelectedId([id]);
          }
        } else {
          setLastSelectedId(id);
          setSelectedId(id);
        }
      },
      [multiSelect, selectGroups, lastSelectedId]
    );

    useEffect(() => {
      if (onValueChange) onValueChange(selectedId);
    }, [selectedId]);

    const handleExpand = useCallback((id: string) => {
      setExpendedItems((prev) => {
        if (prev?.includes(id)) {
          return prev.filter((item) => item !== id);
        }
        return [...(prev ?? []), id];
      });
    }, []);

    const expandSpecificTargetedElements = useCallback(
      (elements?: TreeViewElement[], selectId?: string) => {
        if (!elements || !selectId) return;
        const findParent = (
          currentElement: TreeViewElement,
          currentPath: string[] = []
        ) => {
          const isSelectable = currentElement.isSelectable ?? true;
          const newPath = [...currentPath, currentElement.id];
          if (currentElement.id === selectId) {
            if (isSelectable) {
              setExpendedItems((prev) => [...(prev ?? []), ...newPath]);
            } else {
              if (newPath.includes(currentElement.id)) {
                newPath.pop();
                setExpendedItems((prev) => [...(prev ?? []), ...newPath]);
              }
            }
            return;
          }
          if (
            isSelectable &&
            currentElement.children &&
            currentElement.children.length > 0
          ) {
            currentElement.children.forEach((child) => {
              findParent(child, newPath);
            });
          }
        };
        elements.forEach((element) => {
          findParent(element);
        });
      },
      []
    );

    useEffect(() => {
      if (initialSelectedId) {
        expandSpecificTargetedElements(elements, initialSelectedId);
      }
    }, [initialSelectedId, elements]);

    const direction = dir === 'rtl' ? 'rtl' : 'ltr';

    return (
      <TreeContext.Provider
        value={{
          selectedId,
          expendedItems,
          handleExpand,
          selectItem,
          setExpendedItems,
          indicator,
          openIcon,
          closeIcon,
          direction,
        }}
      >
        <div className={cn('size-full', className)}>
          <ScrollArea
            ref={ref}
            className="h-full relative px-2"
            dir={dir as Direction}
          >
            <AccordionPrimitive.Root
              {...props}
              type="multiple"
              defaultValue={expendedItems}
              value={expendedItems}
              className="flex flex-col gap-1"
              onValueChange={(value) =>
                setExpendedItems((prev) => [...(prev ?? []), value[0]])
              }
              dir={dir as Direction}
            >
              {children}
            </AccordionPrimitive.Root>
          </ScrollArea>
        </div>
      </TreeContext.Provider>
    );
  }
);

Tree.displayName = 'Tree';

const TreeIndicator = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { direction } = useTree();

  return (
    <div
      dir={direction}
      ref={ref}
      className={cn(
        'h-full w-px bg-muted absolute left-1.5 rtl:right-1.5 py-3 rounded-md hover:bg-slate-300 duration-300 ease-in-out',
        className
      )}
      {...props}
    />
  );
});

TreeIndicator.displayName = 'TreeIndicator';

interface FolderComponentProps
  extends React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item> {}

type FolderProps = {
  expendedItems?: string[];
  element: string;
  isSelectable?: boolean;
  isSelect?: boolean;
} & FolderComponentProps;

const Folder = forwardRef<
  HTMLDivElement,
  FolderProps & React.HTMLAttributes<HTMLDivElement>
>(
  (
    {
      className,
      element,
      value,
      isSelectable = true,
      isSelect,
      children,
      ...props
    },
    ref
  ) => {
    const {
      direction,
      handleExpand,
      expendedItems,
      indicator,
      setExpendedItems,
      openIcon,
      closeIcon,
    } = useTree();

    return (
      <AccordionPrimitive.Item
        {...props}
        value={value}
        className="relative overflow-hidden h-full "
      >
        <AccordionPrimitive.Trigger
          className={cn(
            `flex items-center gap-1 text-sm rounded-md`,
            className,
            {
              'bg-muted rounded-md': isSelect && isSelectable,
              'cursor-pointer': isSelectable,
              'cursor-not-allowed opacity-50': !isSelectable,
            }
          )}
          disabled={!isSelectable}
          onClick={() => handleExpand(value)}
        >
          {expendedItems?.includes(value)
            ? openIcon ?? <FolderOpenIcon className="h-4 w-4" />
            : closeIcon ?? <FolderIcon className="h-4 w-4" />}
          <span>{element}</span>
        </AccordionPrimitive.Trigger>
        <AccordionPrimitive.Content className="text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down relative overflow-hidden h-full">
          {element && indicator && <TreeIndicator aria-hidden="true" />}
          <AccordionPrimitive.Root
            dir={direction}
            type="multiple"
            className="flex flex-col gap-1 py-1 ml-5 rtl:mr-5 "
            defaultValue={expendedItems}
            value={expendedItems}
            onValueChange={(value) => {
              setExpendedItems?.((prev) => [...(prev ?? []), value[0]]);
            }}
          >
            {children}
          </AccordionPrimitive.Root>
        </AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    );
  }
);

Folder.displayName = 'Folder';

const File = forwardRef<
  HTMLButtonElement,
  {
    value: string;
    handleSelect?: (id: string) => void;
    isSelectable?: boolean;
    isSelect?: boolean;
    fileIcon?: React.ReactNode;
  } & React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(
  (
    {
      value,
      className,
      handleSelect,
      isSelectable = true,
      isSelect,
      fileIcon,
      children,
      ...props
    },
    ref
  ) => {
    const { direction, selectedId, selectItem } = useTree();
    const isSelected =
      isSelect ?? Array.isArray(selectedId)
        ? (selectedId as string[]).includes(value)
        : selectedId === value;
    return (
      <AccordionPrimitive.Item value={value} className="relative">
        <AccordionPrimitive.Trigger
          ref={ref}
          {...props}
          dir={direction}
          disabled={!isSelectable}
          aria-label="File"
          className={cn(
            'flex items-center gap-1 cursor-pointer text-sm pr-1 rtl:pl-1 rtl:pr-0 rounded-md  duration-200 ease-in-out',
            {
              'bg-muted': isSelected && isSelectable,
            },
            isSelectable ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed',
            className
          )}
          onClick={(event) => selectItem(value, event)}
        >
          {fileIcon ?? <FileIcon className="h-4 w-4" />}
          {children}
        </AccordionPrimitive.Trigger>
      </AccordionPrimitive.Item>
    );
  }
);

File.displayName = 'File';

const CollapseButton = forwardRef<
  HTMLButtonElement,
  {
    elements: TreeViewElement[];
    expandAll?: boolean;
  } & React.HTMLAttributes<HTMLButtonElement>
>(({ className, elements, expandAll = false, children, ...props }, ref) => {
  const { expendedItems, setExpendedItems } = useTree();

  const expendAllTree = useCallback((elements: TreeViewElement[]) => {
    const expandTree = (element: TreeViewElement) => {
      const isSelectable = element.isSelectable ?? true;
      if (isSelectable && element.children && element.children.length > 0) {
        setExpendedItems?.((prev) => [...(prev ?? []), element.id]);
        element.children.forEach(expandTree);
      }
    };

    elements.forEach(expandTree);
  }, []);

  const closeAll = useCallback(() => {
    setExpendedItems?.([]);
  }, []);

  useEffect(() => {
    if (expandAll) {
      expendAllTree(elements);
    }
  }, [expandAll]);

  return (
    <Button
      variant={'ghost'}
      className="h-8 w-fit p-1 absolute bottom-1 right-2"
      onClick={
        expendedItems && expendedItems.length > 0
          ? closeAll
          : () => expendAllTree(elements)
      }
      ref={ref}
      {...props}
    >
      {children}
      <span className="sr-only">Toggle</span>
    </Button>
  );
});

CollapseButton.displayName = 'CollapseButton';

export { Tree, Folder, File, CollapseButton, type TreeViewElement };
