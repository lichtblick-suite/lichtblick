// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * A wrapper around window.showOpenFilePicker that returns an empty array instead of throwing when
 * the user cancels the file picker.
 */
export default async function showOpenFilePicker(
  options?: OpenFilePickerOptions,
): Promise<FileSystemFileHandle[] /* foxglove-depcheck-used: @types/wicg-file-system-access */> {
  try {
    return await window.showOpenFilePicker(options);
  } catch (err) {
    if (err.name === "AbortError") {
      return [];
    }
    throw err;
  }
}
