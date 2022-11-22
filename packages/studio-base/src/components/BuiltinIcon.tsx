// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ICONS from "@foxglove/studio-base/theme/icons";
import { RegisteredIconNames } from "@foxglove/studio-base/types/Icons";

type BuiltinIconProps = {
  name?: RegisteredIconNames;
};

function BuiltinIcon(props: BuiltinIconProps): JSX.Element {
  if (props.name == undefined) {
    return <></>;
  }
  return ICONS[props.name];
}

export { BuiltinIcon };
