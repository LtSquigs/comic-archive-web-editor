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
import { useEffect, useRef, useState } from 'react';
import { ActionState } from './types';
import { useToast } from '@/hooks/use-toast';

export function MoveButton({
  file,
  onMoved,
}: {
  file: string;
  onMoved: (newFile: string, newFileName: string) => {};
}) {
  const [fileName, setFileName] = useState(file);
  const [isOpen, setIsOpen] = useState(false);
  const [moving, setMoving] = useState(ActionState.NONE);
  const { toast } = useToast();

  useEffect(() => {
    setFileName(file);
  }, [file]);

  const moveFile = async () => {
    if (!fileName) {
      return;
    }

    setMoving(ActionState.INPROGRESS);
    const res = await API.moveFile(file, fileName);

    toast({
      title: !res.error ? 'Task Finished' : 'Task Failed',
      variant: !res.error ? 'default' : 'destructive',
      description: !res.error
        ? 'Moving archive completed.'
        : `Error occured while moving archive: ${res.errorStr}.`,
    });
    setMoving(ActionState.NONE);
    setFileName('');

    // Needs to send file basename
    if (!res.error) {
      await onMoved(fileName, res.data);
    }
    setIsOpen(false);
  };
  return (
    <Dialog
      onOpenChange={(open) => {
        if (open === false) {
          setFileName('');
        }
        setIsOpen(open);
      }}
      open={isOpen}
    >
      <DialogTrigger>
        <Button className="mr-2">Move File</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move Archive</DialogTitle>
          <DialogDescription>
            <Label>Current Path</Label>
            <div>{file}</div>
            <Label className="mt-2">New Path</Label>
            <Input
              className="mt-2"
              onChange={(event) => {
                setFileName(event.target.value);
              }}
              value={fileName}
            ></Input>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={!fileName} onClick={moveFile}>
            {moving === ActionState.INPROGRESS ? (
              <UpdateIcon className="mr-1 animate-spin" />
            ) : null}{' '}
            Move File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MoveButton;
