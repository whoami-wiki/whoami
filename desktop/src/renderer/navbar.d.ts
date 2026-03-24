interface Window {
  navbar: {
    goBack: () => void;
    goForward: () => void;
    openSettings: () => void;
    closeSettings: () => void;
    getVersion: () => Promise<string>;
    findInPage: (text: string, options?: { forward?: boolean; findNext?: boolean }) => void;
    stopFindInPage: () => void;
    onNavigationState: (
      callback: (state: { canGoBack: boolean; canGoForward: boolean }) => void,
    ) => void;
    onTitleUpdate: (callback: (title: string) => void) => void;
    onFindShow: (callback: () => void) => void;
    onFindResult: (
      callback: (result: { activeMatchOrdinal: number; matches: number }) => void,
    ) => void;
  };
}
