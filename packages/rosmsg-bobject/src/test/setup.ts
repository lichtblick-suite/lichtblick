// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TextDecoder as UtilTextDecoder } from "util";

// bobjects assume text decoder is available and punts to the user to provide it
global.TextDecoder = UtilTextDecoder as typeof TextDecoder;
