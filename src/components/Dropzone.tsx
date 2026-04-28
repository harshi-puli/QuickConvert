import { useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { loadFfmpeg, convertFile, downloadFile, formatFileSize } from "@/lib/utils";
import { ImageMimeTypes, ImageOutputFormat } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// I think the statuses we use???
type Status = "idle" | "converting" | "done" | "error";
interface FileEntry {
  id: string;
  file: File;
  outputName: string;  
  outputFormat: string;  
  status: Status;
  outputSize?: number;  
  outputUrl?: string;   
  outputFileName?: string; 
}

export const Dropzone = () => {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [entries, setEntries] = useState<FileEntry[]>([]);


  useEffect(() => {
    loadFfmpeg().then((ffmpeg) => {
      ffmpegRef.current = ffmpeg;
      setFfmpegLoaded(true);
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ImageMimeTypes,
    multiple: true,
    onDrop: (files: File[]) => {
     
      const newEntries: FileEntry[] = files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        outputName: file.name.replace(/\.[^.]+$/, ""), 
        outputFormat: "jpeg",
        status: "idle",
      }));
      setEntries((prev) => [...prev, ...newEntries]);
    },
  });

  // Update entries,
  const updateEntry = (id: string, changes: Partial<FileEntry>) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...changes } : e))
    );
  };

  // Remove files,
  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  // Convert file,
  const handleConvert = async (entry: FileEntry) => {
    if (!ffmpegRef.current) return;

    updateEntry(entry.id, { status: "converting" });

    try {
      const fullOutputName = `${entry.outputName}.${entry.outputFormat}`;
      const result = await convertFile(ffmpegRef.current, entry.file, fullOutputName);

      updateEntry(entry.id, {
        status: "done",
        outputSize: result.outputFileSize,
        outputUrl: result.outputObjectUrl,
        outputFileName: result.outputFullName,
      });
    } catch (error) {
      console.error("Conversion failed:", error);
      updateEntry(entry.id, { status: "error" });
    }
  };

  const handleDownload = (entry: FileEntry) => {
    if (entry.outputUrl && entry.outputFileName) {
      downloadFile(entry.outputUrl, entry.outputFileName);
    }
  };


  const handleReset = (id: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, status: "idle", outputSize: undefined, outputUrl: undefined, outputFileName: undefined }
          : e
      )
    );
  };

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">

      {!ffmpegLoaded && (
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
          <Spinner className="h-4 w-4" />
          <span>Loading conversion engine…</span>
        </div>
      )}

      <div
        {...getRootProps()} // the css/styling keeps showing up red on my side but it works so we will do what we gotta do.
        className={`flex h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-colors
          ${isDragActive
            ? "border-blue-400 bg-blue-50 text-blue-600"
            : "border-gray-300 bg-gray-50 text-gray-400 hover:border-gray-400 hover:text-gray-500"
          }`}
      >
        <input {...getInputProps()} />
        <p className="text-lg font-medium">
          {isDragActive ? "Drop your images here!" : "Drag & drop images here"}
        </p>
        <p className="mt-1 text-sm">or click to browse files</p>
        <p className="mt-2 text-xs text-gray-400">Supports JPG, PNG, WEBP, GIF, BMP, TIFF</p>
      </div>

      {entries.length > 0 && (
        <div className="flex flex-col gap-3">

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">
              {entries.length} file{entries.length !== 1 ? "s" : ""} added
            </span>
            <button
              onClick={() => setEntries([])}
              className="text-xs text-gray-400 hover:text-red-500"
              type="button"
            >
              Clear all
            </button>
          </div>

          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
      
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-gray-800">{entry.file.name}</p>
                  <p className="text-xs text-gray-400">
                    {formatFileSize(entry.file.size)}
                   
                    {entry.status === "done" && entry.outputSize != null && (
                      <span className="ml-1 text-green-600">
                        → <strong>{formatFileSize(entry.outputSize)}</strong>
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => removeEntry(entry.id)}
                  className="text-gray-300 hover:text-red-400"
                  type="button"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>

              {entry.status === "idle" && (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-gray-500">Output name</Label>
                    <Input
                      className="h-8 w-48 text-sm"
                      value={entry.outputName}
                      onChange={(e) => updateEntry(entry.id, { outputName: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-gray-500">Format</Label>
                    <Select
                      value={entry.outputFormat}
                      onValueChange={(val) => updateEntry(entry.id, { outputFormat: val })}
                    >
                      <SelectTrigger className="h-8 w-28 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ImageOutputFormat.map((fmt) => (
                          <SelectItem key={fmt} value={fmt}>.{fmt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    className="h-8 text-sm"
                    onClick={() => handleConvert(entry)}
                    disabled={!ffmpegLoaded || !entry.outputName.trim()}
                  >
                    Convert
                  </Button>
                </div>
              )}


              {entry.status === "converting" && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Spinner className="h-4 w-4" />
                  <span>Converting…</span>
                </div>
              )}

         
              {entry.status === "done" && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-green-600">✓ {entry.outputFileName}</span>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleDownload(entry)}
                  >
                    Download
                  </Button>
                  <button
                    onClick={() => handleReset(entry.id)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                    type="button"
                  >
                    ↺ Convert again
                  </button>
                </div>
              )}

              {entry.status === "error" && (
                <div className="flex items-center gap-3 text-sm text-red-500">
                  <span>Conversion failed.</span>
                  <button
                    onClick={() => handleReset(entry.id)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                    type="button"
                  >
                    ↺ Retry
                  </button>
                </div>
              )}

            </div>
          ))}
        </div>
      )}

    </div>
  );
};