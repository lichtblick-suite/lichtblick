const definitions = {
  "foxglove_msgs/ImageMarkerArray": {
    name: "foxglove_msgs/ImageMarkerArray",
    definitions: [
      { type: "visualization_msgs/ImageMarker", name: "markers", isArray: true, isComplex: true },
    ],
  },
  "visualization_msgs/ImageMarker": {
    name: "visualization_msgs/ImageMarker",
    definitions: [
      { type: "uint8", name: "CIRCLE", isConstant: true, value: 0 },
      { type: "uint8", name: "LINE_STRIP", isConstant: true, value: 1 },
      { type: "uint8", name: "LINE_LIST", isConstant: true, value: 2 },
      { type: "uint8", name: "POLYGON", isConstant: true, value: 3 },
      { type: "uint8", name: "POINTS", isConstant: true, value: 4 },
      { type: "uint8", name: "ADD", isConstant: true, value: 0 },
      { type: "uint8", name: "REMOVE", isConstant: true, value: 1 },
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "string", name: "ns", isArray: false, isComplex: false },
      { type: "int32", name: "id", isArray: false, isComplex: false },
      { type: "int32", name: "type", isArray: false, isComplex: false },
      { type: "int32", name: "action", isArray: false, isComplex: false },
      { type: "geometry_msgs/Point", name: "position", isArray: false, isComplex: true },
      { type: "float32", name: "scale", isArray: false, isComplex: false },
      { type: "std_msgs/ColorRGBA", name: "outline_color", isArray: false, isComplex: true },
      { type: "uint8", name: "filled", isArray: false, isComplex: false },
      { type: "std_msgs/ColorRGBA", name: "fill_color", isArray: false, isComplex: true },
      { type: "duration", name: "lifetime", isArray: false, isComplex: false },
      { type: "geometry_msgs/Point", name: "points", isArray: true, isComplex: true },
      { type: "std_msgs/ColorRGBA", name: "outline_colors", isArray: true, isComplex: true },
    ],
  },
  "std_msgs/Header": {
    name: "std_msgs/Header",
    definitions: [
      { type: "uint32", name: "seq", isArray: false, isComplex: false },
      { type: "time", name: "stamp", isArray: false, isComplex: false },
      { type: "string", name: "frame_id", isArray: false, isComplex: false },
    ],
  },
  "geometry_msgs/Point": {
    name: "geometry_msgs/Point",
    definitions: [
      { type: "float64", name: "x", isArray: false, isComplex: false },
      { type: "float64", name: "y", isArray: false, isComplex: false },
      { type: "float64", name: "z", isArray: false, isComplex: false },
    ],
  },
  "std_msgs/ColorRGBA": {
    name: "std_msgs/ColorRGBA",
    definitions: [
      { type: "float32", name: "r", isArray: false, isComplex: false },
      { type: "float32", name: "g", isArray: false, isComplex: false },
      { type: "float32", name: "b", isArray: false, isComplex: false },
      { type: "float32", name: "a", isArray: false, isComplex: false },
    ],
  },
};

module.exports = { definitions };
