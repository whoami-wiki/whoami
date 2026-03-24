interface Window {
  navbar: {
    goBack: () => void;
    goForward: () => void;
    openSettings: () => void;
    closeSettings: () => void;
    getVersion: () => Promise<string>;
    onNavigationState: (
      callback: (state: { canGoBack: boolean; canGoForward: boolean }) => void,
    ) => void;
    onTitleUpdate: (callback: (title: string) => void) => void;
  };
}
