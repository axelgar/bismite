import { CopyButton } from "@/components/copy-button";

// Halo code card: surface-2 with a border, optional window-style filename chrome, optional
// copy. Children are pre-colored spans (we hand-color the few snippets rather than pull in
// a syntax highlighter — ponytail: no dependency for two static snippets).
export function CodeBlock({
  filename,
  copy,
  topBar = false,
  children,
}: {
  filename?: string;
  copy?: string;
  topBar?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-border bg-surface-2">
      {topBar && <div className="h-0.5 bg-[linear-gradient(90deg,#9B7CFF,#7CB5FF,#6EE0D0)]" />}
      {filename && (
        <div className="flex items-center gap-2 border-b border-border-soft px-3.5 py-3">
          <span className="size-2.5 rounded-full bg-input" />
          <span className="size-2.5 rounded-full bg-input" />
          <span className="size-2.5 rounded-full bg-input" />
          <span className="ml-1.5 font-mono text-[11px] text-faint">{filename}</span>
        </div>
      )}
      {copy && <CopyButton text={copy} className="absolute right-2.5 top-2.5" />}
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[13px] leading-[1.8]">
        <code>{children}</code>
      </pre>
    </div>
  );
}
