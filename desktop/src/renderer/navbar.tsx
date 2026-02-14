import { useState, useEffect } from "react";
import { BackIcon, ForwardIcon, SettingsIcon } from "./icons";

interface NavbarProps {
  onSettingsClick: () => void;
  settingsOpen: boolean;
}

export function Navbar({ onSettingsClick, settingsOpen }: NavbarProps) {
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [title, setTitle] = useState("whoami");

  useEffect(() => {
    window.navbar.onNavigationState((state) => {
      setCanGoBack(state.canGoBack);
      setCanGoForward(state.canGoForward);
    });

    window.navbar.onTitleUpdate((newTitle) => {
      setTitle(newTitle || "whoami");
    });
  }, []);

  return (
    <nav className="flex items-center p-2 select-none drag dark:bg-neutral-900 bg-neutral-100 shrink-0">
      <div className="w-19 shrink-0" />

      <div className="flex flex-row gap-2">
        <button
          className="no-drag hover:bg-neutral-200 dark:hover:bg-neutral-800 p-1 rounded-full cursor-pointer text-neutral-600 dark:text-neutral-400"
          disabled={!canGoBack}
          title="Back"
          onClick={() => window.navbar.goBack()}
        >
          <BackIcon />
        </button>

        <button
          className="no-drag hover:bg-neutral-200 dark:hover:bg-neutral-800 p-1 rounded-full cursor-pointer text-neutral-600 dark:text-neutral-400"
          disabled={!canGoForward}
          title="Forward"
          onClick={() => window.navbar.goForward()}
        >
          <ForwardIcon />
        </button>
      </div>

      <div className="flex-1 text-[13px] font-medium text-[#1d1d1f] dark:text-[#e5e5ea] text-center truncate">
        {settingsOpen ? "Settings" : title}
      </div>

      <button
        className={`no-drag hover:bg-neutral-200 dark:hover:bg-neutral-800 p-1 rounded-full cursor-pointer text-neutral-600 dark:text-neutral-400 ${settingsOpen ? "bg-neutral-200 dark:bg-neutral-800" : ""}`}
        title="Settings"
        onClick={onSettingsClick}
      >
        <SettingsIcon />
      </button>
    </nav>
  );
}
