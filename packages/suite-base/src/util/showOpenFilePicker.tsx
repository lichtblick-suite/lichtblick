// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Whether the File System Access API showOpenFilePicker is available.
 */
function isShowOpenFilePickerSupported(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window && typeof window.showOpenFilePicker === "function";
}

/**
 * Fallback for environments that don't support showOpenFilePicker (e.g. Chrome Android):
 * use a hidden <input type="file"> and return handle-like objects so callers can still use getFile().
 */
function showOpenFilePickerFallback(
  options?: OpenFilePickerOptions,
): Promise<FileSystemFileHandle[] /* foxglove-depcheck-used: @types/wicg-file-system-access */> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = options?.multiple ?? false;

    if (options?.types && options.types.length > 0) {
      const acceptParts: string[] = [];
      for (const type of options.types) {
        if (type.accept) {
          for (const [mime, exts] of Object.entries(type.accept)) {
            const extList = Array.isArray(exts) ? exts : [exts];
            acceptParts.push(...extList.map((ext: string) => (ext.startsWith(".") ? ext : `.${ext}`)));
            acceptParts.push(mime);
          }
        }
      }
      input.accept = [...new Set(acceptParts)].join(",");
    }

    input.oncancel = () => resolve([]);
    input.onchange = () => {
      const files = input.files ? Array.from(input.files) : [];
      const handles = files.map(
        (file) =>
          ({
            getFile: () => Promise.resolve(file),
            name: file.name,
            kind: "file" as const,
          }) as FileSystemFileHandle,
      );
      resolve(handles);
      input.remove();
    };

    input.click();
  });
}

/**
 * A wrapper around window.showOpenFilePicker that returns an empty array instead of throwing when
 * the user cancels the file picker.On browsers that don't support the File System Access API
 * (e.g. Chrome Android), falls back to a hidden <input type="file"> so file opening still works.
 */
export default async function showOpenFilePicker(
  options?: OpenFilePickerOptions,
): Promise<FileSystemFileHandle[] /* foxglove-depcheck-used: @types/wicg-file-system-access */> {
  if (!isShowOpenFilePickerSupported()) {
    return await showOpenFilePickerFallback(options);
  }

  try {
    return await window.showOpenFilePicker(options!);
  } catch (err: unknown) {
    if ((err as Error).name === "AbortError") {
      return [];
    }
    throw err;
  }
}
