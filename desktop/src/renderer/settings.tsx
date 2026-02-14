import { useState, useEffect } from "react";

export function Settings() {
  const [version, setVersion] = useState("");

  useEffect(() => {
    window.navbar.getVersion().then(setVersion);
  }, []);

  return (
    <div className="flex h-dvh items-center justify-center bg-neutral-100 dark:bg-neutral-900">
      <div className="w-80 text-center">
        <h1 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-1">
          About
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          whoami {version && `v${version}`}
        </p>
      </div>
    </div>
  );
}
