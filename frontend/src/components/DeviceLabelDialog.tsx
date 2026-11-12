import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DeviceLabelDialogProps {
  open: boolean;
  value: string;
  onOpenChange: (open: boolean) => void;
  onSave: (label: string) => void;
}

export default function DeviceLabelDialog({
  open,
  value,
  onOpenChange,
  onSave,
}: DeviceLabelDialogProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const commit = () => {
    onSave(draft);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-border bg-[#12141c]">
        <DialogHeader>
          <DialogTitle>Name this device</DialogTitle>
          <DialogDescription>
            Your messages are tagged with this name on the other device.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            commit();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="device-label-field" className="text-[10px] tracking-[0.18em] uppercase">
              Device label
            </Label>
            <Input
              id="device-label-field"
              data-testid="device-label-input"
              value={draft}
              maxLength={32}
              autoComplete="off"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Phone"
              className="border-[#2b3145] bg-[#0e1017] font-mono"
            />
          </div>
          <DialogFooter className="rounded-b-none border-0 bg-transparent px-0 pt-0 pb-0">
            <Button
              type="submit"
              size="sm"
              data-testid="device-label-save-button"
              className="gap-1.5"
            >
              <Check className="size-3.5" aria-hidden="true" />
              Save label
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
