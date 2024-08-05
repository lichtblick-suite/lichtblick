// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export const threeDee = {
  // Common
  color: "Color",
  colorMode: "Color mode",
  frame: "Frame",
  lineWidth: "Line width",
  position: "Position",
  reset: "Reset",
  rotation: "Rotation",
  scale: "Scale",
  gradient: "Gradient",
  type: "Type",
  topic: "Topic",

  // Frame
  age: "Age",
  axisScale: "Axis scale",
  displayFrame: "Display frame",
  displayFrameHelp:
    "The coordinate frame to place the camera in. The camera position and orientation will be relative to the origin of this frame.",
  editable: "Editable",
  enablePreloading: "Enable preloading",
  fixed: "Fixed",
  followMode: "Follow mode",
  followModeHelp: "Change the camera behavior during playback to follow the display frame or not.",
  frameNotFound: "Frame {{frameId}} not found",
  hideAll: "Hide all",
  historySize: "History size",
  labels: "Labels",
  labelSize: "Label size",
  lineColor: "Line color",
  noCoordinateFramesFound: "No coordinate frames found",
  parent: "Parent",
  pose: "Pose",
  rotationOffset: "Rotation offset",
  settings: "Settings",
  showAll: "Show all",
  transforms: "Transforms",
  translation: "Translation",
  translationOffset: "Translation offset",

  // Scene
  background: "Background",
  debugPicking: "Debug picking",
  ignoreColladaUpAxis: "Ignore COLLADA <up_axis>",
  ignoreColladaUpAxisHelp:
    "Match the behavior of rviz by ignoring the <up_axis> tag in COLLADA files",
  labelScale: "Label scale",
  labelScaleHelp: "Scale factor to apply to all labels",
  meshUpAxis: "Mesh up axis",
  meshUpAxisHelp:
    "The direction to use as “up” when loading meshes without orientation info (STL and OBJ)",
  renderStats: "Render stats",
  scene: "Scene",
  takeEffectAfterReboot: "This setting requires a restart to take effect",
  YUp: "Y-up",
  ZUp: "Z-up",

  // Camera
  distance: "Distance",
  far: "Far",
  fovy: "Y-Axis FOV",
  near: "Near",
  perspective: "Perspective",
  phi: "Phi",
  planarProjectionFactor: "Planar projection factor",
  syncCamera: "Sync camera",
  syncCameraHelp: "Sync the camera with other panels that also have this setting enabled.",
  target: "Target",
  theta: "Theta",
  view: "View",

  // Topics
  topics: "Topics",

  // Custom layers
  addGrid: "Add Grid",
  addURDF: "Add URDF",
  customLayers: "Custom layers",
  delete: "Delete",
  divisions: "Divisions",
  grid: "Grid",
  size: "Size",

  // Image annotations
  imageAnnotations: "Image annotations",
  resetView: "Reset view",

  // Images
  cameraInfo: "Camera info",

  // Occupancy Grids
  colorModeCustom: "Custom",
  colorModeRaw: "Raw",
  colorModeRvizCostmap: "Costmap",
  colorModeRvizMap: "Map",
  frameLock: "Frame lock",
  invalidColor: "Invalid color",
  maxColor: "Max color",
  minColor: "Min color",
  unknownColor: "Unknown color",

  // Point Extension Utils
  decayTime: "Decay time",
  decayTimeDefaultZeroSeconds: "0 seconds",
  pointShape: "Point shape",
  pointShapeCircle: "Circle",
  pointShapeSquare: "Square",
  pointSize: "Point size",

  // Color Mode
  colorBy: "Color by",
  colorModeBgraPacked: "BGRA (packed)",
  colorModeBgrPacked: "BGR (packed)",
  colorModeColorMap: "Color map",
  colorModeFlat: "Flat",
  colorModeRgbaSeparateFields: "RGBA (separate fields)",
  ColorFieldComputedDistance: "distance (auto)",
  flatColor: "Flat color",
  opacity: "Opacity",
  valueMax: "Value max",
  valueMin: "Value min",

  // Markers
  selectionVariable: "Selection variable",
  selectionVariableHelp:
    "When selecting a marker, this global variable will be set to the marker ID",
  showOutline: "Show outline",

  // Poses
  covariance: "Covariance",
  covarianceColor: "Covariance color",
  poseDisplayTypeArrow: "Arrow",
  poseDisplayTypeAxis: "Axis",
  poseDisplayTypeLine: "Line",

  // Publish
  publish: "Publish",
  publishTopicHelp: "The topic on which to publish",
  publishTypeHelp: "The type of message to publish when clicking in the scene",
  publishTypePoint: "Point (geometry_msgs/Point)",
  publishTypePose: "Pose (geometry_msgs/PoseStamped)",
  publishTypePoseEstimate: "Pose estimate (geometry_msgs/PoseWithCovarianceStamped)",
  thetaDeviation: "Theta deviation",
  thetaDeviationHelp: "The theta standard deviation to publish with pose estimates",
  xDeviation: "X deviation",
  xDeviationHelp: "The X standard deviation to publish with pose estimates",
  yDeviation: "Y deviation",
  yDeviationHelp: "The Y standard deviation to publish with pose estimates",

  // HUD Items and empty states
  noImageTopicsAvailable: "No image topics available.",
  imageTopicDNE: "Image topic does not exist.",
  calibrationTopicDNE: "Calibration topic does not exist.",
  imageAndCalibrationDNE: "Image and calibration topics do not exist.",
  waitingForCalibrationAndImages: "Waiting for messages…",
  waitingForCalibration: "Waiting for calibration messages…",
  waitingForImages: "Waiting for image messages…",
  waitingForSyncAnnotations: "Waiting for synchronized annotations…",
};
