import { useState } from 'react';
import { ActionState } from './types';

import { UpdateIcon } from '@radix-ui/react-icons';
import { API } from './api';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export function DeleteButton({ onDelete }: { onDelete: () => {} }) {
  const [deleteStatus, setDeleteStatus] = useState(ActionState.NONE);
  const { toast } = useToast();

  const doDelete = async () => {
    setDeleteStatus(ActionState.INPROGRESS);
    const deleted = await API.delete();

    toast({
      title: !deleted.error ? 'Task Finished' : 'Task Failed',
      variant: !deleted.error ? 'default' : 'destructive',
      description: !deleted.error
        ? 'Deleting archive completed.'
        : `Error occured while deleting archive: ${deleted.errorStr}.`,
    });

    setDeleteStatus(ActionState.NONE);
    await onDelete();
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger>
        <Button variant={'destructive'}>
          {deleteStatus === ActionState.INPROGRESS ? (
            <UpdateIcon className="mr-1 animate-spin" />
          ) : null}{' '}
          Delete Archive
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to delete?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the files
            selected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={doDelete}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DeleteButton;
