import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { CardType } from '@/types';

interface DismissConfirmDialogProps {
  isOpen: boolean;
  cardType: CardType | null;
  onConfirm: (neverAskAgain: boolean) => void;
  onCancel: () => void;
}

const CARD_NAMES: Record<CardType, string> = {
  history: 'History',
  chat: 'Chat',
  search: 'Search Results',
  scripture: 'Scripture',
  resources: 'Resources',
  notes: 'Notes',
};

export function DismissConfirmDialog({
  isOpen,
  cardType,
  onConfirm,
  onCancel,
}: DismissConfirmDialogProps) {
  const [neverAskAgain, setNeverAskAgain] = useState(false);

  const handleConfirm = () => {
    onConfirm(neverAskAgain);
    setNeverAskAgain(false);
  };

  const handleCancel = () => {
    onCancel();
    setNeverAskAgain(false);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hide {cardType ? CARD_NAMES[cardType] : 'this card'}?</AlertDialogTitle>
          <AlertDialogDescription>
            You can swipe to show it again when new content is available.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-center space-x-2 py-4">
          <Checkbox
            id="never-ask"
            checked={neverAskAgain}
            onCheckedChange={(checked) => setNeverAskAgain(checked === true)}
          />
          <label
            htmlFor="never-ask"
            className="text-sm text-muted-foreground cursor-pointer"
          >
            Don't ask me again
          </label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>Hide</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
