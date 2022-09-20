// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ros1, ros2galactic } from "@foxglove/rosmsg-msgs-common";
import { foxgloveMessageSchemas, generateRosMsgDefinition } from "@foxglove/schemas/internal";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

/**
 * basicDatatypes is a map containing definitions for ROS common datatypes and foxglove datatypes
 * from the following packages:
 *
 * - @foxglove/rosmsgs-msg-common
 * - @foxglove/schemas
 */
export const basicDatatypes: RosDatatypes = new Map();

// Add ROS2 message schemas
for (const [name, def] of Object.entries(ros2galactic)) {
  basicDatatypes.set(name, def);
}

// Add ROS1 message schemas
for (const [name, def] of Object.entries(ros1)) {
  basicDatatypes.set(name, def);
}

// Add foxglove message schemas
for (const schema of Object.values(foxgloveMessageSchemas)) {
  const definition = generateRosMsgDefinition(schema, { rosVersion: 1 });
  basicDatatypes.set(definition.rosMsgInterfaceName, {
    name: definition.rosMsgInterfaceName,
    definitions: definition.fields,
  });
  basicDatatypes.set(`foxglove.${schema.name}`, {
    name: `foxglove.${schema.name}`,
    definitions: definition.fields,
  });
}

// Add the legacy foxglove_msgs/ImageMarkerArray message definition
basicDatatypes.set("foxglove_msgs/ImageMarkerArray", {
  definitions: [
    { name: "markers", type: "visualization_msgs/ImageMarker", isComplex: true, isArray: true },
  ],
});
