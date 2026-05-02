interface Props {
  type?: string;
  snapshot?: string;
  note?: string;
}

export function CiteVault({ type, snapshot, note }: Props) {
  return (
    <aside className="text-xs text-slate-600 dark:text-slate-400 my-2 p-2 bg-slate-50 dark:bg-slate-900 border-l-2 border-slate-300 dark:border-slate-700 rounded-r">
      <div className="font-semibold mb-1">Vault citation</div>
      {type ? <div><span className="font-medium">type:</span> {type}</div> : null}
      {snapshot ? <div><span className="font-medium">snapshot:</span> <code className="text-[10px]">{snapshot}</code></div> : null}
      {note ? <div className="mt-1">{note}</div> : null}
    </aside>
  );
}
