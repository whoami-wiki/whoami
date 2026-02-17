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

export function ChevronLeftSmallIcon({ className }: { className?: string }) {
  return (
    <svg
      width="1.1em"
      height="1.1em"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path
        d="M14.7071 5.29289C15.0976 5.68342 15.0976 6.31658 14.7071 6.70711L9.41421 12L14.7071 17.2929C15.0976 17.6834 15.0976 18.3166 14.7071 18.7071C14.3166 19.0976 13.6834 19.0976 13.2929 18.7071L7.29289 12.7071C7.10536 12.5196 7 12.2652 7 12C7 11.7348 7.10536 11.4804 7.29289 11.2929L13.2929 5.29289C13.6834 4.90237 14.3166 4.90237 14.7071 5.29289Z"
        fill="currentColor"
      ></path>
    </svg>
  );
}

export const LoadingSpinner = ({ size = 40 }: { size?: number }) => (
  <svg
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
  >
    <path
      d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z"
      opacity=".25"
    />
    <path d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z">
      <animateTransform
        attributeName="transform"
        type="rotate"
        dur="0.75s"
        values="0 12 12;360 12 12"
        repeatCount="indefinite"
      />
    </path>
  </svg>
);
