// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Extension } from "./Extension";

export class ExtensionInstance {
  readonly uri: string;
  readonly packageJson: unknown;
  extension?: Extension;
  enabled: boolean;

  constructor(uri: string, packageJson: unknown, enabled: boolean) {
    this.uri = uri;
    this.packageJson = packageJson;
    this.enabled = enabled;
  }

  name(): string {
    const name = (this.packageJson as { name?: string }).name;
    return typeof name === "string" && name.length > 0 ? name : this.uri;
  }

  version(): string {
    const version = (this.packageJson as { version?: string }).version;
    return typeof version === "string" && version.length > 0 ? version : "0.0.0";
  }
}
