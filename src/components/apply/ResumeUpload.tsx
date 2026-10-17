"use client";

import { useState, useRef, useId } from "react";
import { validatePdfFile } from "@/lib/application/form-utils";
import { getResumeUploadUrl } from "@/lib/application/api";

interface ResumeUploadProps {
  value: string | null;
  onChange: (path: string | null) => void;
  disabled?: boolean;
  error?: string;
}

export function ResumeUpload({ value, onChange, disabled = false, error }: ResumeUploadProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

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

  const displayError = error || uploadError;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-neutral-700">
        Resume (PDF)
        <span className="ml-1 text-red-500" aria-hidden="true">*</span>
      </label>
      <p className="text-sm text-neutral-500">PDF only, max 5 MB</p>

      {value && fileName ? (
        <div className="flex items-center gap-3 rounded-lg border border-neutral-300 bg-neutral-50 p-3">
          <svg
            className="h-8 w-8 flex-shrink-0 text-red-500"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
            <path d="M14 2v6h6M9 15v2h6v-2H9zm0-3v2h6v-2H9z" fill="white" />
          </svg>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-900">{fileName}</p>
            <p className="text-xs text-neutral-500">Uploaded successfully</p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="text-sm text-neutral-600 underline hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : isUploading ? (
        <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-900">Uploading {fileName}...</p>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full bg-neutral-900 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : displayError ? (
        <div className="space-y-2">
          <div className="rounded-lg border border-red-300 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 flex-shrink-0 text-red-500"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Upload failed</p>
                <p className="mt-1 text-sm text-red-700">{displayError}</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            disabled={disabled}
            className="text-sm font-medium text-neutral-900 underline hover:no-underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            Try again
          </button>
        </div>
      ) : (
        <div
          className="rounded-lg border-2 border-dashed border-neutral-300 p-6 text-center hover:border-neutral-400"
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
          <svg
            className="mx-auto h-12 w-12 text-neutral-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="mt-4">
            <label
              htmlFor={id}
              className="cursor-pointer text-sm font-medium text-neutral-900 underline hover:no-underline"
            >
              Upload a file
            </label>
            <span className="text-sm text-neutral-500"> or drag and drop</span>
          </div>
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
    </div>
  );
}
