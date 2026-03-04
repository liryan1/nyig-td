import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
}

export function QRCodeDialog({ open, onOpenChange, tournamentId }: QRCodeDialogProps) {
  const [copied, setCopied] = useState(false);
  const checkInUrl = `${window.location.origin}/tournaments/${tournamentId}/checkin`;

  const handleCopy = () => {
    navigator.clipboard.writeText(checkInUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Player Check-In QR Code</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <QRCodeSVG value={checkInUrl} size={256} />
          <p className="text-sm text-muted-foreground text-center break-all">
            {checkInUrl}
          </p>
          <Button variant="outline" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
