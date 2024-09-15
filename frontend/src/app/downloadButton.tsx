import { Button } from '@/components/ui/button';
import { API } from './api';

export function DownloadButton({
  file,
  filename,
}: {
  file: string;
  filename: string | null;
}) {
  const downloadFile = () => {
    const link = document.createElement('a');
    link.href = API.getDownloadUrl(file);
    link.download = filename || 'archive.cbz';
    link.click();
  };
  return (
    <Button className="mr-2" onClick={downloadFile}>
      Download Archive
    </Button>
  );
}

export default DownloadButton;
