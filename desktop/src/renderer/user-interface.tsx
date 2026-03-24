import { useState, useCallback, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { Navbar } from "./navbar";
import { Settings } from "./settings";
import { FindBar } from "./find-bar";

/// <reference path="navbar.d.ts" />

type View = "wiki" | "settings";

function App() {
  const [view, setView] = useState<View>("wiki");
  const [findOpen, setFindOpen] = useState(false);

  useEffect(() => {
    window.navbar.onFindShow(() => setFindOpen(true));
  }, []);

  const handleSettingsClick = useCallback(() => {
    setView((prev) => {
      if (prev === "settings") {
        window.navbar.closeSettings();
        return "wiki";
      } else {
        window.navbar.openSettings();
        return "settings";
      }
    });
  }, []);

  return (
    <div className="flex flex-col h-full">
      <Navbar onSettingsClick={handleSettingsClick} settingsOpen={view === "settings"} />
      {findOpen && <FindBar onClose={() => setFindOpen(false)} />}
      {view === "settings" && <Settings />}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
