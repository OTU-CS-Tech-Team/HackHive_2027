"use client";

import { useState, useRef, useId } from "react";
import { validatePdfFile } from "@/lib/application/form-utils";
import { getResumeUploadUrl } from "@/lib/application/api";
import { CircleAlert, CloudUpload, FileText } from "lucide-react";
import { errorClass, hintClass, labelClass, linkClass } from "./styles";

interface ResumeUploadProps {
  value: string | null;
  onChange: (path: string | null) => void;
  disabled?: boolean;
  error?: string;
}

function deriveDisplayName(path: string | null): string | null {
  if (!path) return null;
  const parts = path.split("/");
  const filename = parts[parts.length - 1];
  const match = filename.match(/^resume-[a-f0-9-]+\.pdf$/i);
  if (match) {
    return "resume.pdf";
  }
  return filename;
}

export function ResumeUpload({ value, onChange, disabled = false, error }: ResumeUploadProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const displayName = fileName || deriveDisplayName(value);
  const hasUploadedFile = Boolean(value);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    const validation = validatePdfFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || "Invalid file");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setFileName(file.name);

    try {
      const result = await getResumeUploadUrl();

      if (!result.ok) {
        throw new Error(result.error);
      }

      setUploadProgress(30);

      const uploadResponse = await fetch(result.signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/pdf",
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to storage");
      }

      setUploadProgress(100);

      onChange(result.path);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      onChange(null);
      setFileName(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    onChange(null);
    setFileName(null);
    setUploadError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleRetry = () => {
    setUploadError(null);
    inputRef.current?.click();
  };

  return (
    <div className="space-y-2">
      <label htmlFor={id} className={labelClass}>
        Resume
      </label>
      <p className={hintClass}>PDF only, max 5 MB</p>

      {hasUploadedFile && !isUploading ? (
        <div className="flex items-center gap-3 rounded-xl border border-hive-line bg-hive-field p-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-hive-honey-soft text-hive-ink">
            <FileText className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-hive-ink">{displayName}</p>
            {error ? (
              <p className={errorClass} role="alert">{error}</p>
            ) : (
              <p className="text-xs text-hive-muted">Uploaded</p>
            )}
          </div>
          <button type="button" onClick={handleRemove} disabled={disabled} className={`text-sm ${linkClass}`}>
            Remove
          </button>
        </div>
      ) : isUploading ? (
        <div className="rounded-xl border border-hive-line bg-hive-field p-4">
          <p className="truncate text-sm font-semibold text-hive-ink">Uploading {fileName}…</p>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-hive-line">
            <div className="h-full bg-hive-honey transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      ) : uploadError ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <CircleAlert className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Upload failed</p>
            <p className="mt-0.5 text-sm text-red-700">{uploadError}</p>
            <button type="button" onClick={handleRetry} disabled={disabled} className={`mt-2 text-sm ${linkClass}`}>
              Try again
            </button>
          </div>
        </div>
      ) : (
        <div
          className="group relative rounded-xl border-2 border-dashed border-hive-line bg-hive-field px-6 py-9 text-center transition-colors hover:border-hive-honey has-focus-visible:border-hive-honey"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file && inputRef.current) {
              const dt = new DataTransfer();
              dt.items.add(file);
              inputRef.current.files = dt.files;
              inputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }}
        >
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-white text-hive-ink shadow-sm transition-transform group-hover:-translate-y-0.5">
            <CloudUpload className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm text-hive-muted">
            <label htmlFor={id} className="cursor-pointer font-semibold text-hive-ink after:absolute after:inset-0">
              Choose a PDF
            </label>{" "}
            or drag it here
          </p>
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            disabled={disabled}
            className="sr-only"
          />
        </div>
      )}
      {/* A missing-resume error sits under the drop zone so they can still upload. */}
      {error && !hasUploadedFile && (
        <p className={errorClass} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
