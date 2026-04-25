import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PwaInstallButton() {
  const [promptEvent, setPromptEvent] = useState(null);

  useEffect(() => {
    const listener = (event) => {
      event.preventDefault();
      setPromptEvent(event);
    };

    window.addEventListener('beforeinstallprompt', listener);
    return () => window.removeEventListener('beforeinstallprompt', listener);
  }, []);

  if (!promptEvent) {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        promptEvent.prompt();
        await promptEvent.userChoice;
        setPromptEvent(null);
      }}
    >
      <Download className="h-4 w-4 mr-2" />
      Install App
    </Button>
  );
}
