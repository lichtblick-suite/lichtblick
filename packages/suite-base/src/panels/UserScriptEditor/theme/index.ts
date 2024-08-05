// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as monacoApi from "monaco-editor/esm/vs/editor/editor.api";

import vsStudioDarkTheme from "./vs-studio-dark";
import vsStudioLightTheme from "./vs-studio-light";

type Theme = {
  name: string;
  theme: monacoApi.editor.IStandaloneThemeData;
};

const themes: readonly Theme[] = [
  {
    name: "vs-studio-dark",
    theme: vsStudioDarkTheme,
  },
  {
    name: "vs-studio-light",
    theme: vsStudioLightTheme,
  },
];

export { themes };
