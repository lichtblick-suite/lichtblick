// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// This alias is used so that we can prevent null in most places, but still use it
// where required for React (such as refs and returning from render).
// eslint-disable-next-line no-restricted-syntax
type ReactNull = null;

// Should match DefinePlugin in webpack configuration
declare const ReactNull: ReactNull;
