"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createProjectAction } from "./actions";
import { RevealKeys } from "./reveal-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Create a project, then reveal both secrets ONCE inside the same dialog. The reveal is a
// modal so it reads as important/secure; closing discards the secrets for good (regenerate
// to get a fresh one) — that's the whole point of show-once.
export function CreateProject() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ projectId: string; test: string; live: string } | null>(null);

  function reset() {
    setName("");
    setError("");
    setCreated(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          // Refresh the list so the new project shows once the reveal is dismissed.
          if (created) router.refresh();
          reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus /> New project
        </Button>
      </DialogTrigger>

      <DialogContent>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Project created</DialogTitle>
              <DialogDescription>
                <span className="font-mono text-foreground-2">{created.projectId}</span>
              </DialogDescription>
            </DialogHeader>
            <RevealKeys test={created.test} live={created.live} />
            <Button variant="secondary" onClick={() => setOpen(false)} className="w-full">
              Done
            </Button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New project</DialogTitle>
              <DialogDescription>Name it — you can change this later.</DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                const res = await createProjectAction(name);
                setBusy(false);
                if ("error" in res) return setError(res.error ?? "");
                setCreated(res);
              }}
            >
              <Input
                placeholder="my-ai-app"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                required
              />
              {error && (
                <p role="alert" className="text-[13px] text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Creating…" : "Create project"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
