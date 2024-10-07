import { Entry } from '../shared/types';

import { API } from './api';

export function CoverSelector({ files = [] }: { files: string[] }) {
  return (
    <>
      {files.length > 1 ? (
        <div className="w-full h-full flex justify-center items-center">
          <b>Multiple Files Selected</b>
        </div>
      ) : (
        <div className="relative">
          <img src={API.getCoverUrl()} className="max-w-full max-h-full" />
        </div>
      )}
    </>
  );
}
