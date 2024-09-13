export type FileEntry = {
  directory: boolean;
  name: string;
  path: string;
  parentPath: string;
};

export type SplitMarker = {
  startEntry: string;
  endEntry: string;
  filename: string;
};

export type APIResult<T> =
  | {
      error: false;
      data: T;
    }
  | {
      error: true;
      aborted?: boolean;
      errorStr: string;
    };

export enum ActionState {
  NONE,
  INPROGRESS,
  SUCCESS,
  FAILED,
}
