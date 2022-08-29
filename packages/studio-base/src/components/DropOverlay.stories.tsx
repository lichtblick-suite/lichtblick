// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import DropOverlay from "@foxglove/studio-base/components/DropOverlay";

export default {
  title: "components/DropOverlay",
  component: DropOverlay,
};

export const Dark = (): JSX.Element => <DropOverlay open>Some DropOverlay</DropOverlay>;
Dark.parameters = { colorScheme: "dark" };

export const Light = (): JSX.Element => <DropOverlay open>Some DropOverlay</DropOverlay>;
Light.parameters = { colorScheme: "light" };
