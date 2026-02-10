"use client";

interface Props {
  name: string;
  top: string;
  left: string;
}

export function Folder(props: Props) {
  const { name, top, left } = props;

  return (
    <div
      className="absolute flex flex-col gap-2 max-w-16 items-center"
      style={{ top, left }}
    >
      <div>
        <div className="h-1 w-5 bg-blue-400 rounded-md rounded-b-none" />
        <div className="w-11 h-8 bg-blue-400 rounded-sm rounded-tl-none" />
      </div>
      <div className="font-sans text-xs wrap-break-word text-white text-shadow-lg text-center">
        {name}
      </div>
    </div>
  );
}
