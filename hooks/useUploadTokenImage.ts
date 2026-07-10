"use client";

import { useCallback, useState } from "react";
import { getStorageAdapter } from "@/lib/storage/upload";

const MAX_SIZE_MB = 4;

/**
 * Token image upload. Currently local-preview only (see lib/storage/upload.ts);
 * the returned `previewUrl` is an object URL, and `storageConfigured` tells the
 * UI whether a permanent upload backend exists.
 */
export function useUploadTokenImage() {
  const adapter = getStorageAdapter();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectFile = useCallback(
    async (f: File) => {
      setError(null);
      if (!f.type.startsWith("image/")) {
        setError("Please choose an image file.");
        return;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`Image must be under ${MAX_SIZE_MB}MB.`);
        return;
      }
      setFile(f);
      const url = await adapter.uploadImage(f);
      setPreviewUrl(url);
    },
    [adapter],
  );

  const clear = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setError(null);
  }, [previewUrl]);

  return {
    file,
    previewUrl,
    error,
    selectFile,
    clear,
    storageConfigured: adapter.isConfigured,
  };
}
