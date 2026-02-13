export function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M21 8a1 1 0 0 0-1-1H4a1 1 0 0 0 0 2h16a1 1 0 0 0 1-1Zm0 8a1 1 0 0 0-1-1H10a1 1 0 1 0 0 2h10a1 1 0 0 0 1-1Z"></path>
    </svg>
  );
}

export function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path
        d="M5.63603 5.63603C6.02656 5.24551 6.65972 5.24551 7.05025 5.63603L12 10.5858L16.9497 5.63603C17.3403 5.24551 17.9734 5.24551 18.364 5.63603C18.7545 6.02656 18.7545 6.65972 18.364 7.05025L13.4142 12L18.364 16.9497C18.7545 17.3403 18.7545 17.9734 18.364 18.364C17.9734 18.7545 17.3403 18.7545 16.9497 18.364L12 13.4142L7.05025 18.364C6.65972 18.7545 6.02656 18.7545 5.63603 18.364C5.24551 17.9734 5.24551 17.3403 5.63603 16.9497L10.5858 12L5.63603 7.05025C5.24551 6.65972 5.24551 6.02656 5.63603 5.63603Z"
        fill="currentColor"
      ></path>
    </svg>
  );
}
