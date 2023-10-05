// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Defines a predefined file & code we make available for imports in user scripts.
 */
export type UserScriptProjectFile = {
  fileName: string;
  filePath: string;
  sourceCode: string;
};

/**
 * Defines a project configuration for a user script, including types we make available
 * for use in user script code.
 */
export type UserScriptProjectConfig = {
  defaultLibFileName: string;
  declarations: UserScriptProjectFile[];
  utilityFiles: UserScriptProjectFile[];
  rosLib: UserScriptProjectFile;
};
