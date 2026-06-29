"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { regenerateAction } from "../actions";
import type { Mode } from "@/lib/counter";
import { Button } from "@/components/ui/button";
import { CopyField } from "@/components/copy-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Regenerate one mode's key and reveal the new secret once. The old key stops resolving
// immediately (counter does an atomic upsert), so this is the rotate path. The confirm is a
// real dialog (not window.confirm) and the new secret reveals inline, show-once.
export function Regenerate({ projectId, mode }: { projectId: string; mode: Mode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function confirm() {
    setBusy(true);
    setError("");
    const res = await regenerateAction(projectId, mode);
    setBusy(false);
    if ("error" in res) {
      setError(res.error ?? "");
      toast.error(res.error ?? "Couldn’t regenerate");
      return;
    }
    setKey(res.key);
    toast.success(`New ${mode} key generated`);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          if (key) router.refresh(); // refresh "last used"/timestamps after a rotate
          setKey(null);
          setError("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <RefreshCw /> Regenerate
        </Button>
      </DialogTrigger>

      <DialogContent>
        {key ? (
          <>
            <DialogHeader>
              <DialogTitle>New {mode} key</DialogTitle>
              <DialogDescription>Copy it now — it’s shown once.</DialogDescription>
            </DialogHeader>
            <CopyField value={key} />
            <Button variant="secondary" onClick={() => setOpen(false)} className="w-full">
              Done
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Regenerate the {mode} key?</DialogTitle>
              <DialogDescription>
                The current {mode} key stops working immediately. Anything using it must be updated.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-start gap-2.5 rounded-[10px] border border-[rgba(240,85,106,0.35)] bg-[rgba(240,85,106,0.08)] p-3 text-[13px] text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>This can’t be undone.</span>
            </div>
            {error && (
              <p role="alert" className="text-[13px] text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirm} disabled={busy}>
                {busy ? "…" : `Regenerate ${mode}`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
