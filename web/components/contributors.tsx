export function Contributors({ names }: { names: string[] }) {
  return (
    <div className="not-prose flex flex-col gap-3 py-2">
      <div className="text-sm text-neutral-500 dark:text-neutral-400 font-sans">
        Contributors
      </div>
      <div className="flex flex-row flex-wrap gap-3">
        {names.map((name) => (
          <div
            key={name}
            className="flex flex-row items-center gap-2 rounded-full border border-neutral-200 dark:border-neutral-700 px-3 py-1.5"
          >
            <div className="size-6 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-xs font-medium text-neutral-500 dark:text-neutral-400 font-sans">
              {name.charAt(0)}
            </div>
            <span className="text-sm font-sans text-primary">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
