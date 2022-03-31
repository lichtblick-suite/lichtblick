// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ExtensionInfo, ExtensionLoader } from "@foxglove/studio-base";

export class NoopExtensionLoader implements ExtensionLoader {
  async getExtensions(): Promise<ExtensionInfo[]> {
    return [];
  }

  async loadExtension(_id: string): Promise<string> {
    throw new Error(`not implemented`);
  }

  async downloadExtension(_url: string): Promise<Uint8Array> {
    throw new Error("Download the desktop app to use extensions.");
  }

  async installExtension(_foxeFileData: Uint8Array): Promise<ExtensionInfo> {
    throw new Error("Download the desktop app to use extensions.");
  }

  async uninstallExtension(_id: string): Promise<boolean> {
    return false;
  }
}
