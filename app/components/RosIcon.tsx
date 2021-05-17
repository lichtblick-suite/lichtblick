// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { createSvgIcon } from "@fluentui/react-icons-mdl2";

import RosSvg from "@foxglove/studio-base/assets/ros.svg";

export default createSvgIcon({
  displayName: "RosIcon",
  svg({ classes }) {
    return <RosSvg className={classes.svg} style={{ width: "auto" }} />;
  },
});
