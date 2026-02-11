"use client";

export type FileType = "folder" | "pdf" | "zip" | "csv" | "json" | "audio" | "txt";

interface Props {
  name: string;
  type: FileType;
  top: string;
  left: string;
}

function FolderIcon() {
  return (
    <div>
      <div className="h-1 w-5 bg-blue-400 rounded-md rounded-b-none" />
      <div className="w-11 h-8 bg-blue-400 rounded-sm rounded-tl-none" />
    </div>
  );
}

function FileIcon({ label, color }: { label: string; color: string }) {
  return (
    <div className={`relative w-10 h-12 ${color} rounded-sm`}>
      <div className="absolute top-0 right-0 w-3 h-3 bg-white/30 rounded-bl-sm" />
      <div className="absolute bottom-1.5 inset-x-0 text-center">
        <span className="text-[8px] font-sans font-bold text-white/80 uppercase">
          {label}
        </span>
      </div>
    </div>
  );
}

const fileConfig: Record<Exclude<FileType, "folder">, { label: string; color: string }> = {
  pdf: { label: "PDF", color: "bg-red-400" },
  zip: { label: "ZIP", color: "bg-yellow-500" },
  csv: { label: "CSV", color: "bg-green-500" },
  json: { label: "JSON", color: "bg-purple-400" },
  audio: { label: "M4A", color: "bg-pink-400" },
  txt: { label: "TXT", color: "bg-neutral-400" },
};

export function File({ name, type, top, left }: Props) {
  return (
    <div
      className="absolute flex flex-col gap-2 max-w-16 items-center"
      style={{ top, left }}
    >
      {type === "folder" ? <FolderIcon /> : <FileIcon {...fileConfig[type]} />}
      <div className="font-sans text-xs wrap-break-word text-white text-shadow-lg text-center">
        {name}
      </div>
    </div>
  );
}
