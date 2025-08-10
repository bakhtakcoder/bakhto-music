import { useCallback, useState } from "react";

interface DropzoneProps {
  onFiles: (files: FileList) => void;
}

export const Dropzone = ({ onFiles }: DropzoneProps) => {
  const [active, setActive] = useState(false);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      onFiles(e.dataTransfer.files);
    }
  }, [onFiles]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setActive(true); }}
      onDragLeave={() => setActive(false)}
      onDrop={onDrop}
      className={`border-2 border-dashed rounded-xl p-6 transition-colors ${active ? 'border-accent bg-accent/5' : 'border-border'}`}
      aria-label="Upload audio via drag and drop"
    >
      <div className="text-center space-y-2">
        <p className="font-medium">Drag & Drop your audio here</p>
        <p className="text-sm text-muted-foreground">MP3, WAV, OGG up to ~50MB</p>
        <div className="mt-3">
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => e.target.files && onFiles(e.target.files)}
            className="block w-full text-sm file:mr-4 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-foreground hover:file:bg-secondary/80"
          />
        </div>
      </div>
    </div>
  );
};
