// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// Bring in global modules and overrides required by studio source files
// This adds type declarations for scss, bag, etc imports
// This adds type declarations for global react
// See typings/index.d.ts for additional included references
/// <reference types="./typings" />

import App from "@foxglove-studio/app/App";
import ErrorBoundary from "@foxglove-studio/app/components/ErrorBoundary";
import MultiProvider from "@foxglove-studio/app/components/MultiProvider";
import { PlayerSourceDefinition } from "@foxglove-studio/app/context/PlayerSelectionContext";
import ThemeProvider from "@foxglove-studio/app/theme/ThemeProvider";

export { App, ErrorBoundary, MultiProvider, ThemeProvider };

export type { PlayerSourceDefinition };
