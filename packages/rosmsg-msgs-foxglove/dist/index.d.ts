import { RosMsgDefinition } from "@foxglove/rosmsg";

declare module "@foxglove/rosmsg-msgs-foxglove" {
  type RosMsgCommonDefinitions = {
    "foxglove_msgs/ImageMarkerArray": RosMsgDefinition;
    "geometry_msgs/Point": RosMsgDefinition;
    "std_msgs/ColorRGBA": RosMsgDefinition;
    "std_msgs/Header": RosMsgDefinition;
    "visualization_msgs/ImageMarker": RosMsgDefinition;
  };

  const definitions: RosMsgCommonDefinitions;
  export { definitions };
}
