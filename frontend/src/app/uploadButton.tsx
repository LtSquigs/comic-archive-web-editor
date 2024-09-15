import { Button } from '@/components/ui/button';
import { API } from './api';
import { PlusIcon, UpdateIcon } from '@radix-ui/react-icons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useRef, useState } from 'react';
import { ActionState } from './types';
import { useToast } from '@/hooks/use-toast';

export function UploadButton({
  path,
  sep,
  onUploaded,
}: {
  path: string;
  sep: string;
  onUploaded: () => {};
}) {
  const [fileName, setFileName] = useState('');
  const [hasFile, setHasFile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(ActionState.NONE);
  const file = useRef<File | null>(null);
  const { toast } = useToast();

  const uploadFile = async () => {
    if (file.current === null || !fileName) {
      return;
    }

    setUploading(ActionState.INPROGRESS);
    const res = await API.uploadArchive(file.current, fileName);

    toast({
      title: !res.error ? 'Task Finished' : 'Task Failed',
      variant: !res.error ? 'default' : 'destructive',
      description: !res.error
        ? 'Uploading archive completed.'
        : `Error occured while uploading archive: ${res.errorStr}.`,
    });
    setUploading(ActionState.NONE);
    file.current = null;
    setHasFile(false);
    setFileName('');
    setIsOpen(false);

    await onUploaded();
  };
  return (
    <Dialog
      onOpenChange={(open) => {
        if (open === false) {
          file.current = null;
          setHasFile(false);
          setFileName('');
        }
        setIsOpen(open);
      }}
      open={isOpen}
    >
      <DialogTrigger>
        <Button variant="link">
          <PlusIcon></PlusIcon>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Archive</DialogTitle>
          <DialogDescription>
            <Label>Upload Path</Label>
            <Input className="mt-2 mb-2" value={fileName}></Input>
            <Label>Archive</Label>
            <Input
              className="mt-2"
              type="file"
              accept=".zip,.cbz,application/zip"
              onChange={(event) => {
                if (!event.target.files || event.target.files.length === 0) {
                  file.current = null;
                  setHasFile(false);
                  setFileName('');
                  return;
                }
                const selectedFile = event.target.files[0];
                file.current = selectedFile;
                setHasFile(true);
                setFileName(
                  [path, selectedFile.name].filter((x) => x).join(sep)
                );
              }}
            ></Input>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={!hasFile && !fileName} onClick={uploadFile}>
            {uploading === ActionState.INPROGRESS ? (
              <UpdateIcon className="mr-1 animate-spin" />
            ) : null}{' '}
            Upload File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default UploadButton;
