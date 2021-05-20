// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

const definitions = {
  "actionlib_msgs/GoalStatusArray": {
    name: "actionlib_msgs/GoalStatusArray",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "actionlib_msgs/GoalStatus", name: "status_list", isArray: true, isComplex: true },
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
  "actionlib_msgs/GoalStatus": {
    name: "actionlib_msgs/GoalStatus",
    definitions: [
      { type: "actionlib_msgs/GoalID", name: "goal_id", isArray: false, isComplex: true },
      { type: "uint8", name: "status", isArray: false, isComplex: false },
      { type: "uint8", name: "PENDING", isConstant: true, value: 0 },
      { type: "uint8", name: "ACTIVE", isConstant: true, value: 1 },
      { type: "uint8", name: "PREEMPTED", isConstant: true, value: 2 },
      { type: "uint8", name: "SUCCEEDED", isConstant: true, value: 3 },
      { type: "uint8", name: "ABORTED", isConstant: true, value: 4 },
      { type: "uint8", name: "REJECTED", isConstant: true, value: 5 },
      { type: "uint8", name: "PREEMPTING", isConstant: true, value: 6 },
      { type: "uint8", name: "RECALLING", isConstant: true, value: 7 },
      { type: "uint8", name: "RECALLED", isConstant: true, value: 8 },
      { type: "uint8", name: "LOST", isConstant: true, value: 9 },
      { type: "string", name: "text", isArray: false, isComplex: false },
    ],
  },
  "actionlib_msgs/GoalID": {
    name: "actionlib_msgs/GoalID",
    definitions: [
      { type: "time", name: "stamp", isArray: false, isComplex: false },
      { type: "string", name: "id", isArray: false, isComplex: false },
    ],
  },
  "diagnostic_msgs/DiagnosticArray": {
    name: "diagnostic_msgs/DiagnosticArray",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "diagnostic_msgs/DiagnosticStatus", name: "status", isArray: true, isComplex: true },
    ],
  },
  "diagnostic_msgs/DiagnosticStatus": {
    name: "diagnostic_msgs/DiagnosticStatus",
    definitions: [
      { type: "int8", name: "OK", isConstant: true, value: 0 },
      { type: "int8", name: "WARN", isConstant: true, value: 1 },
      { type: "int8", name: "ERROR", isConstant: true, value: 2 },
      { type: "int8", name: "STALE", isConstant: true, value: 3 },
      { type: "int8", name: "level", isArray: false, isComplex: false },
      { type: "string", name: "name", isArray: false, isComplex: false },
      { type: "string", name: "message", isArray: false, isComplex: false },
      { type: "string", name: "hardware_id", isArray: false, isComplex: false },
      { type: "diagnostic_msgs/KeyValue", name: "values", isArray: true, isComplex: true },
    ],
  },
  "diagnostic_msgs/KeyValue": {
    name: "diagnostic_msgs/KeyValue",
    definitions: [
      { type: "string", name: "key", isArray: false, isComplex: false },
      { type: "string", name: "value", isArray: false, isComplex: false },
    ],
  },
  "geometry_msgs/AccelStamped": {
    name: "geometry_msgs/AccelStamped",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "geometry_msgs/Accel", name: "accel", isArray: false, isComplex: true },
    ],
  },
  "geometry_msgs/Accel": {
    name: "geometry_msgs/Accel",
    definitions: [
      { type: "geometry_msgs/Vector3", name: "linear", isArray: false, isComplex: true },
      { type: "geometry_msgs/Vector3", name: "angular", isArray: false, isComplex: true },
    ],
  },
  "geometry_msgs/Vector3": {
    name: "geometry_msgs/Vector3",
    definitions: [
      { type: "float64", name: "x", isArray: false, isComplex: false },
      { type: "float64", name: "y", isArray: false, isComplex: false },
      { type: "float64", name: "z", isArray: false, isComplex: false },
    ],
  },
  "geometry_msgs/AccelWithCovarianceStamped": {
    name: "geometry_msgs/AccelWithCovarianceStamped",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "geometry_msgs/AccelWithCovariance", name: "accel", isArray: false, isComplex: true },
    ],
  },
  "geometry_msgs/AccelWithCovariance": {
    name: "geometry_msgs/AccelWithCovariance",
    definitions: [
      { type: "geometry_msgs/Accel", name: "accel", isArray: false, isComplex: true },
      { type: "float64", name: "covariance", isArray: true, arrayLength: 36, isComplex: false },
    ],
  },
  "geometry_msgs/InertiaStamped": {
    name: "geometry_msgs/InertiaStamped",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "geometry_msgs/Inertia", name: "inertia", isArray: false, isComplex: true },
    ],
  },
  "geometry_msgs/Inertia": {
    name: "geometry_msgs/Inertia",
    definitions: [
      { type: "float64", name: "m", isArray: false, isComplex: false },
      { type: "geometry_msgs/Vector3", name: "com", isArray: false, isComplex: true },
      { type: "float64", name: "ixx", isArray: false, isComplex: false },
      { type: "float64", name: "ixy", isArray: false, isComplex: false },
      { type: "float64", name: "ixz", isArray: false, isComplex: false },
      { type: "float64", name: "iyy", isArray: false, isComplex: false },
      { type: "float64", name: "iyz", isArray: false, isComplex: false },
      { type: "float64", name: "izz", isArray: false, isComplex: false },
    ],
  },
  "geometry_msgs/Point32": {
    name: "geometry_msgs/Point32",
    definitions: [
      { type: "float32", name: "x", isArray: false, isComplex: false },
      { type: "float32", name: "y", isArray: false, isComplex: false },
      { type: "float32", name: "z", isArray: false, isComplex: false },
    ],
  },
  "geometry_msgs/PointStamped": {
    name: "geometry_msgs/PointStamped",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "geometry_msgs/Point", name: "point", isArray: false, isComplex: true },
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
  "geometry_msgs/PolygonStamped": {
    name: "geometry_msgs/PolygonStamped",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "geometry_msgs/Polygon", name: "polygon", isArray: false, isComplex: true },
    ],
  },
  "geometry_msgs/Polygon": {
    name: "geometry_msgs/Polygon",
    definitions: [
      { type: "geometry_msgs/Point32", name: "points", isArray: true, isComplex: true },
    ],
  },
  "geometry_msgs/PoseArray": {
    name: "geometry_msgs/PoseArray",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "geometry_msgs/Pose", name: "poses", isArray: true, isComplex: true },
    ],
  },
  "geometry_msgs/Pose": {
    name: "geometry_msgs/Pose",
    definitions: [
      { type: "geometry_msgs/Point", name: "position", isArray: false, isComplex: true },
      { type: "geometry_msgs/Quaternion", name: "orientation", isArray: false, isComplex: true },
    ],
  },
  "geometry_msgs/Quaternion": {
    name: "geometry_msgs/Quaternion",
    definitions: [
      { type: "float64", name: "x", isArray: false, isComplex: false },
      { type: "float64", name: "y", isArray: false, isComplex: false },
      { type: "float64", name: "z", isArray: false, isComplex: false },
      { type: "float64", name: "w", isArray: false, isComplex: false },
    ],
  },
  "geometry_msgs/PoseStamped": {
    name: "geometry_msgs/PoseStamped",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "geometry_msgs/Pose", name: "pose", isArray: false, isComplex: true },
    ],
  },
  "geometry_msgs/PoseWithCovarianceStamped": {
    name: "geometry_msgs/PoseWithCovarianceStamped",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "geometry_msgs/PoseWithCovariance", name: "pose", isArray: false, isComplex: true },
    ],
  },
  "geometry_msgs/PoseWithCovariance": {
    name: "geometry_msgs/PoseWithCovariance",
    definitions: [
      { type: "geometry_msgs/Pose", name: "pose", isArray: false, isComplex: true },
      { type: "float64", name: "covariance", isArray: true, arrayLength: 36, isComplex: false },
    ],
  },
  "geometry_msgs/QuaternionStamped": {
    name: "geometry_msgs/QuaternionStamped",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "geometry_msgs/Quaternion", name: "quaternion", isArray: false, isComplex: true },
    ],
  },
  "geometry_msgs/TransformStamped": {
    name: "geometry_msgs/TransformStamped",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "string", name: "child_frame_id", isArray: false, isComplex: false },
      { type: "geometry_msgs/Transform", name: "transform", isArray: false, isComplex: true },
    ],
  },
  "geometry_msgs/Transform": {
    name: "geometry_msgs/Transform",
    definitions: [
      { type: "geometry_msgs/Vector3", name: "translation", isArray: false, isComplex: true },
      { type: "geometry_msgs/Quaternion", name: "rotation", isArray: false, isComplex: true },
    ],
  },
  "geometry_msgs/TwistStamped": {
    name: "geometry_msgs/TwistStamped",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "geometry_msgs/Twist", name: "twist", isArray: false, isComplex: true },
    ],
  },
  "geometry_msgs/Twist": {
    name: "geometry_msgs/Twist",
    definitions: [
      { type: "geometry_msgs/Vector3", name: "linear", isArray: false, isComplex: true },
      { type: "geometry_msgs/Vector3", name: "angular", isArray: false, isComplex: true },
    ],
  },
  "geometry_msgs/TwistWithCovarianceStamped": {
    name: "geometry_msgs/TwistWithCovarianceStamped",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "geometry_msgs/TwistWithCovariance", name: "twist", isArray: false, isComplex: true },
    ],
  },
  "geometry_msgs/TwistWithCovariance": {
    name: "geometry_msgs/TwistWithCovariance",
    definitions: [
      { type: "geometry_msgs/Twist", name: "twist", isArray: false, isComplex: true },
      { type: "float64", name: "covariance", isArray: true, arrayLength: 36, isComplex: false },
    ],
  },
  "geometry_msgs/Vector3Stamped": {
    name: "geometry_msgs/Vector3Stamped",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "geometry_msgs/Vector3", name: "vector", isArray: false, isComplex: true },
    ],
  },
  "geometry_msgs/WrenchStamped": {
    name: "geometry_msgs/WrenchStamped",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "geometry_msgs/Wrench", name: "wrench", isArray: false, isComplex: true },
    ],
  },
  "geometry_msgs/Wrench": {
    name: "geometry_msgs/Wrench",
    definitions: [
      { type: "geometry_msgs/Vector3", name: "force", isArray: false, isComplex: true },
      { type: "geometry_msgs/Vector3", name: "torque", isArray: false, isComplex: true },
    ],
  },
  "nav_msgs/OccupancyGrid": {
    name: "nav_msgs/OccupancyGrid",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "nav_msgs/MapMetaData", name: "info", isArray: false, isComplex: true },
      { type: "int8", name: "data", isArray: true, isComplex: false },
    ],
  },
  "nav_msgs/MapMetaData": {
    name: "nav_msgs/MapMetaData",
    definitions: [
      { type: "time", name: "map_load_time", isArray: false, isComplex: false },
      { type: "float32", name: "resolution", isArray: false, isComplex: false },
      { type: "uint32", name: "width", isArray: false, isComplex: false },
      { type: "uint32", name: "height", isArray: false, isComplex: false },
      { type: "geometry_msgs/Pose", name: "origin", isArray: false, isComplex: true },
    ],
  },
  "nav_msgs/Odometry": {
    name: "nav_msgs/Odometry",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "string", name: "child_frame_id", isArray: false, isComplex: false },
      { type: "geometry_msgs/PoseWithCovariance", name: "pose", isArray: false, isComplex: true },
      { type: "geometry_msgs/TwistWithCovariance", name: "twist", isArray: false, isComplex: true },
    ],
  },
  "nav_msgs/Path": {
    name: "nav_msgs/Path",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "geometry_msgs/PoseStamped", name: "poses", isArray: true, isComplex: true },
    ],
  },
  "rosgraph_msgs/Clock": {
    name: "rosgraph_msgs/Clock",
    definitions: [{ type: "time", name: "clock", isArray: false, isComplex: false }],
  },
  "rosgraph_msgs/Log": {
    name: "rosgraph_msgs/Log",
    definitions: [
      { type: "int8", name: "DEBUG", isConstant: true, value: 1 },
      { type: "int8", name: "INFO", isConstant: true, value: 2 },
      { type: "int8", name: "WARN", isConstant: true, value: 4 },
      { type: "int8", name: "ERROR", isConstant: true, value: 8 },
      { type: "int8", name: "FATAL", isConstant: true, value: 16 },
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "int8", name: "level", isArray: false, isComplex: false },
      { type: "string", name: "name", isArray: false, isComplex: false },
      { type: "string", name: "msg", isArray: false, isComplex: false },
      { type: "string", name: "file", isArray: false, isComplex: false },
      { type: "string", name: "function", isArray: false, isComplex: false },
      { type: "uint32", name: "line", isArray: false, isComplex: false },
      { type: "string", name: "topics", isArray: true, isComplex: false },
    ],
  },
  "rosgraph_msgs/TopicStatistics": {
    name: "rosgraph_msgs/TopicStatistics",
    definitions: [
      { type: "string", name: "topic", isArray: false, isComplex: false },
      { type: "string", name: "node_pub", isArray: false, isComplex: false },
      { type: "string", name: "node_sub", isArray: false, isComplex: false },
      { type: "time", name: "window_start", isArray: false, isComplex: false },
      { type: "time", name: "window_stop", isArray: false, isComplex: false },
      { type: "int32", name: "delivered_msgs", isArray: false, isComplex: false },
      { type: "int32", name: "dropped_msgs", isArray: false, isComplex: false },
      { type: "int32", name: "traffic", isArray: false, isComplex: false },
      { type: "duration", name: "period_mean", isArray: false, isComplex: false },
      { type: "duration", name: "period_stddev", isArray: false, isComplex: false },
      { type: "duration", name: "period_max", isArray: false, isComplex: false },
      { type: "duration", name: "stamp_age_mean", isArray: false, isComplex: false },
      { type: "duration", name: "stamp_age_stddev", isArray: false, isComplex: false },
      { type: "duration", name: "stamp_age_max", isArray: false, isComplex: false },
    ],
  },
  "sensor_msgs/BatteryState": {
    name: "sensor_msgs/BatteryState",
    definitions: [
      { type: "uint8", name: "POWER_SUPPLY_STATUS_UNKNOWN", isConstant: true, value: 0 },
      { type: "uint8", name: "POWER_SUPPLY_STATUS_CHARGING", isConstant: true, value: 1 },
      { type: "uint8", name: "POWER_SUPPLY_STATUS_DISCHARGING", isConstant: true, value: 2 },
      { type: "uint8", name: "POWER_SUPPLY_STATUS_NOT_CHARGING", isConstant: true, value: 3 },
      { type: "uint8", name: "POWER_SUPPLY_STATUS_FULL", isConstant: true, value: 4 },
      { type: "uint8", name: "POWER_SUPPLY_HEALTH_UNKNOWN", isConstant: true, value: 0 },
      { type: "uint8", name: "POWER_SUPPLY_HEALTH_GOOD", isConstant: true, value: 1 },
      { type: "uint8", name: "POWER_SUPPLY_HEALTH_OVERHEAT", isConstant: true, value: 2 },
      { type: "uint8", name: "POWER_SUPPLY_HEALTH_DEAD", isConstant: true, value: 3 },
      { type: "uint8", name: "POWER_SUPPLY_HEALTH_OVERVOLTAGE", isConstant: true, value: 4 },
      { type: "uint8", name: "POWER_SUPPLY_HEALTH_UNSPEC_FAILURE", isConstant: true, value: 5 },
      { type: "uint8", name: "POWER_SUPPLY_HEALTH_COLD", isConstant: true, value: 6 },
      {
        type: "uint8",
        name: "POWER_SUPPLY_HEALTH_WATCHDOG_TIMER_EXPIRE",
        isConstant: true,
        value: 7,
      },
      {
        type: "uint8",
        name: "POWER_SUPPLY_HEALTH_SAFETY_TIMER_EXPIRE",
        isConstant: true,
        value: 8,
      },
      { type: "uint8", name: "POWER_SUPPLY_TECHNOLOGY_UNKNOWN", isConstant: true, value: 0 },
      { type: "uint8", name: "POWER_SUPPLY_TECHNOLOGY_NIMH", isConstant: true, value: 1 },
      { type: "uint8", name: "POWER_SUPPLY_TECHNOLOGY_LION", isConstant: true, value: 2 },
      { type: "uint8", name: "POWER_SUPPLY_TECHNOLOGY_LIPO", isConstant: true, value: 3 },
      { type: "uint8", name: "POWER_SUPPLY_TECHNOLOGY_LIFE", isConstant: true, value: 4 },
      { type: "uint8", name: "POWER_SUPPLY_TECHNOLOGY_NICD", isConstant: true, value: 5 },
      { type: "uint8", name: "POWER_SUPPLY_TECHNOLOGY_LIMN", isConstant: true, value: 6 },
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "float32", name: "voltage", isArray: false, isComplex: false },
      { type: "float32", name: "temperature", isArray: false, isComplex: false },
      { type: "float32", name: "current", isArray: false, isComplex: false },
      { type: "float32", name: "charge", isArray: false, isComplex: false },
      { type: "float32", name: "capacity", isArray: false, isComplex: false },
      { type: "float32", name: "design_capacity", isArray: false, isComplex: false },
      { type: "float32", name: "percentage", isArray: false, isComplex: false },
      { type: "uint8", name: "power_supply_status", isArray: false, isComplex: false },
      { type: "uint8", name: "power_supply_health", isArray: false, isComplex: false },
      { type: "uint8", name: "power_supply_technology", isArray: false, isComplex: false },
      { type: "bool", name: "present", isArray: false, isComplex: false },
      { type: "float32", name: "cell_voltage", isArray: true, isComplex: false },
      { type: "float32", name: "cell_temperature", isArray: true, isComplex: false },
      { type: "string", name: "location", isArray: false, isComplex: false },
      { type: "string", name: "serial_number", isArray: false, isComplex: false },
    ],
  },
  "sensor_msgs/CameraInfo": {
    name: "sensor_msgs/CameraInfo",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "uint32", name: "height", isArray: false, isComplex: false },
      { type: "uint32", name: "width", isArray: false, isComplex: false },
      { type: "string", name: "distortion_model", isArray: false, isComplex: false },
      { type: "float64", name: "D", isArray: true, isComplex: false },
      { type: "float64", name: "K", isArray: true, arrayLength: 9, isComplex: false },
      { type: "float64", name: "R", isArray: true, arrayLength: 9, isComplex: false },
      { type: "float64", name: "P", isArray: true, arrayLength: 12, isComplex: false },
      { type: "uint32", name: "binning_x", isArray: false, isComplex: false },
      { type: "uint32", name: "binning_y", isArray: false, isComplex: false },
      { type: "sensor_msgs/RegionOfInterest", name: "roi", isArray: false, isComplex: true },
    ],
  },
  "sensor_msgs/RegionOfInterest": {
    name: "sensor_msgs/RegionOfInterest",
    definitions: [
      { type: "uint32", name: "x_offset", isArray: false, isComplex: false },
      { type: "uint32", name: "y_offset", isArray: false, isComplex: false },
      { type: "uint32", name: "height", isArray: false, isComplex: false },
      { type: "uint32", name: "width", isArray: false, isComplex: false },
      { type: "bool", name: "do_rectify", isArray: false, isComplex: false },
    ],
  },
  "sensor_msgs/CompressedImage": {
    name: "sensor_msgs/CompressedImage",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "string", name: "format", isArray: false, isComplex: false },
      { type: "uint8", name: "data", isArray: true, isComplex: false },
    ],
  },
  "sensor_msgs/FluidPressure": {
    name: "sensor_msgs/FluidPressure",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "float64", name: "fluid_pressure", isArray: false, isComplex: false },
      { type: "float64", name: "variance", isArray: false, isComplex: false },
    ],
  },
  "sensor_msgs/Illuminance": {
    name: "sensor_msgs/Illuminance",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "float64", name: "illuminance", isArray: false, isComplex: false },
      { type: "float64", name: "variance", isArray: false, isComplex: false },
    ],
  },
  "sensor_msgs/Image": {
    name: "sensor_msgs/Image",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "uint32", name: "height", isArray: false, isComplex: false },
      { type: "uint32", name: "width", isArray: false, isComplex: false },
      { type: "string", name: "encoding", isArray: false, isComplex: false },
      { type: "uint8", name: "is_bigendian", isArray: false, isComplex: false },
      { type: "uint32", name: "step", isArray: false, isComplex: false },
      { type: "uint8", name: "data", isArray: true, isComplex: false },
    ],
  },
  "sensor_msgs/Imu": {
    name: "sensor_msgs/Imu",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "geometry_msgs/Quaternion", name: "orientation", isArray: false, isComplex: true },
      {
        type: "float64",
        name: "orientation_covariance",
        isArray: true,
        arrayLength: 9,
        isComplex: false,
      },
      { type: "geometry_msgs/Vector3", name: "angular_velocity", isArray: false, isComplex: true },
      {
        type: "float64",
        name: "angular_velocity_covariance",
        isArray: true,
        arrayLength: 9,
        isComplex: false,
      },
      {
        type: "geometry_msgs/Vector3",
        name: "linear_acceleration",
        isArray: false,
        isComplex: true,
      },
      {
        type: "float64",
        name: "linear_acceleration_covariance",
        isArray: true,
        arrayLength: 9,
        isComplex: false,
      },
    ],
  },
  "sensor_msgs/JointState": {
    name: "sensor_msgs/JointState",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "string", name: "name", isArray: true, isComplex: false },
      { type: "float64", name: "position", isArray: true, isComplex: false },
      { type: "float64", name: "velocity", isArray: true, isComplex: false },
      { type: "float64", name: "effort", isArray: true, isComplex: false },
    ],
  },
  "sensor_msgs/Joy": {
    name: "sensor_msgs/Joy",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "float32", name: "axes", isArray: true, isComplex: false },
      { type: "int32", name: "buttons", isArray: true, isComplex: false },
    ],
  },
  "sensor_msgs/JoyFeedbackArray": {
    name: "sensor_msgs/JoyFeedbackArray",
    definitions: [
      { type: "sensor_msgs/JoyFeedback", name: "array", isArray: true, isComplex: true },
    ],
  },
  "sensor_msgs/JoyFeedback": {
    name: "sensor_msgs/JoyFeedback",
    definitions: [
      { type: "uint8", name: "TYPE_LED", isConstant: true, value: 0 },
      { type: "uint8", name: "TYPE_RUMBLE", isConstant: true, value: 1 },
      { type: "uint8", name: "TYPE_BUZZER", isConstant: true, value: 2 },
      { type: "uint8", name: "type", isArray: false, isComplex: false },
      { type: "uint8", name: "id", isArray: false, isComplex: false },
      { type: "float32", name: "intensity", isArray: false, isComplex: false },
    ],
  },
  "sensor_msgs/LaserScan": {
    name: "sensor_msgs/LaserScan",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "float32", name: "angle_min", isArray: false, isComplex: false },
      { type: "float32", name: "angle_max", isArray: false, isComplex: false },
      { type: "float32", name: "angle_increment", isArray: false, isComplex: false },
      { type: "float32", name: "time_increment", isArray: false, isComplex: false },
      { type: "float32", name: "scan_time", isArray: false, isComplex: false },
      { type: "float32", name: "range_min", isArray: false, isComplex: false },
      { type: "float32", name: "range_max", isArray: false, isComplex: false },
      { type: "float32", name: "ranges", isArray: true, isComplex: false },
      { type: "float32", name: "intensities", isArray: true, isComplex: false },
    ],
  },
  "sensor_msgs/MagneticField": {
    name: "sensor_msgs/MagneticField",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "geometry_msgs/Vector3", name: "magnetic_field", isArray: false, isComplex: true },
      {
        type: "float64",
        name: "magnetic_field_covariance",
        isArray: true,
        arrayLength: 9,
        isComplex: false,
      },
    ],
  },
  "sensor_msgs/MultiDOFJointState": {
    name: "sensor_msgs/MultiDOFJointState",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "string", name: "joint_names", isArray: true, isComplex: false },
      { type: "geometry_msgs/Transform", name: "transforms", isArray: true, isComplex: true },
      { type: "geometry_msgs/Twist", name: "twist", isArray: true, isComplex: true },
      { type: "geometry_msgs/Wrench", name: "wrench", isArray: true, isComplex: true },
    ],
  },
  "sensor_msgs/MultiEchoLaserScan": {
    name: "sensor_msgs/MultiEchoLaserScan",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "float32", name: "angle_min", isArray: false, isComplex: false },
      { type: "float32", name: "angle_max", isArray: false, isComplex: false },
      { type: "float32", name: "angle_increment", isArray: false, isComplex: false },
      { type: "float32", name: "time_increment", isArray: false, isComplex: false },
      { type: "float32", name: "scan_time", isArray: false, isComplex: false },
      { type: "float32", name: "range_min", isArray: false, isComplex: false },
      { type: "float32", name: "range_max", isArray: false, isComplex: false },
      { type: "sensor_msgs/LaserEcho", name: "ranges", isArray: true, isComplex: true },
      { type: "sensor_msgs/LaserEcho", name: "intensities", isArray: true, isComplex: true },
    ],
  },
  "sensor_msgs/LaserEcho": {
    name: "sensor_msgs/LaserEcho",
    definitions: [{ type: "float32", name: "echoes", isArray: true, isComplex: false }],
  },
  "sensor_msgs/NavSatFix": {
    name: "sensor_msgs/NavSatFix",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "sensor_msgs/NavSatStatus", name: "status", isArray: false, isComplex: true },
      { type: "float64", name: "latitude", isArray: false, isComplex: false },
      { type: "float64", name: "longitude", isArray: false, isComplex: false },
      { type: "float64", name: "altitude", isArray: false, isComplex: false },
      {
        type: "float64",
        name: "position_covariance",
        isArray: true,
        arrayLength: 9,
        isComplex: false,
      },
      { type: "uint8", name: "COVARIANCE_TYPE_UNKNOWN", isConstant: true, value: 0 },
      { type: "uint8", name: "COVARIANCE_TYPE_APPROXIMATED", isConstant: true, value: 1 },
      { type: "uint8", name: "COVARIANCE_TYPE_DIAGONAL_KNOWN", isConstant: true, value: 2 },
      { type: "uint8", name: "COVARIANCE_TYPE_KNOWN", isConstant: true, value: 3 },
      { type: "uint8", name: "position_covariance_type", isArray: false, isComplex: false },
    ],
  },
  "sensor_msgs/NavSatStatus": {
    name: "sensor_msgs/NavSatStatus",
    definitions: [
      { type: "int8", name: "STATUS_NO_FIX", isConstant: true, value: -1 },
      { type: "int8", name: "STATUS_FIX", isConstant: true, value: 0 },
      { type: "int8", name: "STATUS_SBAS_FIX", isConstant: true, value: 1 },
      { type: "int8", name: "STATUS_GBAS_FIX", isConstant: true, value: 2 },
      { type: "int8", name: "status", isArray: false, isComplex: false },
      { type: "uint16", name: "SERVICE_GPS", isConstant: true, value: 1 },
      { type: "uint16", name: "SERVICE_GLONASS", isConstant: true, value: 2 },
      { type: "uint16", name: "SERVICE_COMPASS", isConstant: true, value: 4 },
      { type: "uint16", name: "SERVICE_GALILEO", isConstant: true, value: 8 },
      { type: "uint16", name: "service", isArray: false, isComplex: false },
    ],
  },
  "sensor_msgs/PointCloud2": {
    name: "sensor_msgs/PointCloud2",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "uint32", name: "height", isArray: false, isComplex: false },
      { type: "uint32", name: "width", isArray: false, isComplex: false },
      { type: "sensor_msgs/PointField", name: "fields", isArray: true, isComplex: true },
      { type: "bool", name: "is_bigendian", isArray: false, isComplex: false },
      { type: "uint32", name: "point_step", isArray: false, isComplex: false },
      { type: "uint32", name: "row_step", isArray: false, isComplex: false },
      { type: "uint8", name: "data", isArray: true, isComplex: false },
      { type: "bool", name: "is_dense", isArray: false, isComplex: false },
    ],
  },
  "sensor_msgs/PointField": {
    name: "sensor_msgs/PointField",
    definitions: [
      { type: "uint8", name: "INT8", isConstant: true, value: 1 },
      { type: "uint8", name: "UINT8", isConstant: true, value: 2 },
      { type: "uint8", name: "INT16", isConstant: true, value: 3 },
      { type: "uint8", name: "UINT16", isConstant: true, value: 4 },
      { type: "uint8", name: "INT32", isConstant: true, value: 5 },
      { type: "uint8", name: "UINT32", isConstant: true, value: 6 },
      { type: "uint8", name: "FLOAT32", isConstant: true, value: 7 },
      { type: "uint8", name: "FLOAT64", isConstant: true, value: 8 },
      { type: "string", name: "name", isArray: false, isComplex: false },
      { type: "uint32", name: "offset", isArray: false, isComplex: false },
      { type: "uint8", name: "datatype", isArray: false, isComplex: false },
      { type: "uint32", name: "count", isArray: false, isComplex: false },
    ],
  },
  "sensor_msgs/Range": {
    name: "sensor_msgs/Range",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "uint8", name: "ULTRASOUND", isConstant: true, value: 0 },
      { type: "uint8", name: "INFRARED", isConstant: true, value: 1 },
      { type: "uint8", name: "radiation_type", isArray: false, isComplex: false },
      { type: "float32", name: "field_of_view", isArray: false, isComplex: false },
      { type: "float32", name: "min_range", isArray: false, isComplex: false },
      { type: "float32", name: "max_range", isArray: false, isComplex: false },
      { type: "float32", name: "range", isArray: false, isComplex: false },
    ],
  },
  "sensor_msgs/RelativeHumidity": {
    name: "sensor_msgs/RelativeHumidity",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "float64", name: "relative_humidity", isArray: false, isComplex: false },
      { type: "float64", name: "variance", isArray: false, isComplex: false },
    ],
  },
  "sensor_msgs/Temperature": {
    name: "sensor_msgs/Temperature",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "float64", name: "temperature", isArray: false, isComplex: false },
      { type: "float64", name: "variance", isArray: false, isComplex: false },
    ],
  },
  "sensor_msgs/TimeReference": {
    name: "sensor_msgs/TimeReference",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "time", name: "time_ref", isArray: false, isComplex: false },
      { type: "string", name: "source", isArray: false, isComplex: false },
    ],
  },
  "shape_msgs/Mesh": {
    name: "shape_msgs/Mesh",
    definitions: [
      { type: "shape_msgs/MeshTriangle", name: "triangles", isArray: true, isComplex: true },
      { type: "geometry_msgs/Point", name: "vertices", isArray: true, isComplex: true },
    ],
  },
  "shape_msgs/MeshTriangle": {
    name: "shape_msgs/MeshTriangle",
    definitions: [
      { type: "uint32", name: "vertex_indices", isArray: true, arrayLength: 3, isComplex: false },
    ],
  },
  "shape_msgs/Plane": {
    name: "shape_msgs/Plane",
    definitions: [
      { type: "float64", name: "coef", isArray: true, arrayLength: 4, isComplex: false },
    ],
  },
  "shape_msgs/SolidPrimitive": {
    name: "shape_msgs/SolidPrimitive",
    definitions: [
      { type: "uint8", name: "BOX", isConstant: true, value: 1 },
      { type: "uint8", name: "SPHERE", isConstant: true, value: 2 },
      { type: "uint8", name: "CYLINDER", isConstant: true, value: 3 },
      { type: "uint8", name: "CONE", isConstant: true, value: 4 },
      { type: "uint8", name: "type", isArray: false, isComplex: false },
      { type: "float64", name: "dimensions", isArray: true, isComplex: false },
      { type: "uint8", name: "BOX_X", isConstant: true, value: 0 },
      { type: "uint8", name: "BOX_Y", isConstant: true, value: 1 },
      { type: "uint8", name: "BOX_Z", isConstant: true, value: 2 },
      { type: "uint8", name: "SPHERE_RADIUS", isConstant: true, value: 0 },
      { type: "uint8", name: "CYLINDER_HEIGHT", isConstant: true, value: 0 },
      { type: "uint8", name: "CYLINDER_RADIUS", isConstant: true, value: 1 },
      { type: "uint8", name: "CONE_HEIGHT", isConstant: true, value: 0 },
      { type: "uint8", name: "CONE_RADIUS", isConstant: true, value: 1 },
    ],
  },
  "std_msgs/Bool": {
    name: "std_msgs/Bool",
    definitions: [{ type: "bool", name: "data", isArray: false, isComplex: false }],
  },
  "std_msgs/Byte": {
    name: "std_msgs/Byte",
    definitions: [{ type: "int8", name: "data", isArray: false, isComplex: false }],
  },
  "std_msgs/ByteMultiArray": {
    name: "std_msgs/ByteMultiArray",
    definitions: [
      { type: "std_msgs/MultiArrayLayout", name: "layout", isArray: false, isComplex: true },
      { type: "int8", name: "data", isArray: true, isComplex: false },
    ],
  },
  "std_msgs/MultiArrayLayout": {
    name: "std_msgs/MultiArrayLayout",
    definitions: [
      { type: "std_msgs/MultiArrayDimension", name: "dim", isArray: true, isComplex: true },
      { type: "uint32", name: "data_offset", isArray: false, isComplex: false },
    ],
  },
  "std_msgs/MultiArrayDimension": {
    name: "std_msgs/MultiArrayDimension",
    definitions: [
      { type: "string", name: "label", isArray: false, isComplex: false },
      { type: "uint32", name: "size", isArray: false, isComplex: false },
      { type: "uint32", name: "stride", isArray: false, isComplex: false },
    ],
  },
  "std_msgs/Char": {
    name: "std_msgs/Char",
    definitions: [{ type: "uint8", name: "data", isArray: false, isComplex: false }],
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
  "std_msgs/Duration": {
    name: "std_msgs/Duration",
    definitions: [{ type: "duration", name: "data", isArray: false, isComplex: false }],
  },
  "std_msgs/Empty": { name: "std_msgs/Empty", definitions: [] },
  "std_msgs/Float32": {
    name: "std_msgs/Float32",
    definitions: [{ type: "float32", name: "data", isArray: false, isComplex: false }],
  },
  "std_msgs/Float32MultiArray": {
    name: "std_msgs/Float32MultiArray",
    definitions: [
      { type: "std_msgs/MultiArrayLayout", name: "layout", isArray: false, isComplex: true },
      { type: "float32", name: "data", isArray: true, isComplex: false },
    ],
  },
  "std_msgs/Float64": {
    name: "std_msgs/Float64",
    definitions: [{ type: "float64", name: "data", isArray: false, isComplex: false }],
  },
  "std_msgs/Float64MultiArray": {
    name: "std_msgs/Float64MultiArray",
    definitions: [
      { type: "std_msgs/MultiArrayLayout", name: "layout", isArray: false, isComplex: true },
      { type: "float64", name: "data", isArray: true, isComplex: false },
    ],
  },
  "std_msgs/Int16": {
    name: "std_msgs/Int16",
    definitions: [{ type: "int16", name: "data", isArray: false, isComplex: false }],
  },
  "std_msgs/Int16MultiArray": {
    name: "std_msgs/Int16MultiArray",
    definitions: [
      { type: "std_msgs/MultiArrayLayout", name: "layout", isArray: false, isComplex: true },
      { type: "int16", name: "data", isArray: true, isComplex: false },
    ],
  },
  "std_msgs/Int32": {
    name: "std_msgs/Int32",
    definitions: [{ type: "int32", name: "data", isArray: false, isComplex: false }],
  },
  "std_msgs/Int32MultiArray": {
    name: "std_msgs/Int32MultiArray",
    definitions: [
      { type: "std_msgs/MultiArrayLayout", name: "layout", isArray: false, isComplex: true },
      { type: "int32", name: "data", isArray: true, isComplex: false },
    ],
  },
  "std_msgs/Int64": {
    name: "std_msgs/Int64",
    definitions: [{ type: "int64", name: "data", isArray: false, isComplex: false }],
  },
  "std_msgs/Int64MultiArray": {
    name: "std_msgs/Int64MultiArray",
    definitions: [
      { type: "std_msgs/MultiArrayLayout", name: "layout", isArray: false, isComplex: true },
      { type: "int64", name: "data", isArray: true, isComplex: false },
    ],
  },
  "std_msgs/Int8": {
    name: "std_msgs/Int8",
    definitions: [{ type: "int8", name: "data", isArray: false, isComplex: false }],
  },
  "std_msgs/Int8MultiArray": {
    name: "std_msgs/Int8MultiArray",
    definitions: [
      { type: "std_msgs/MultiArrayLayout", name: "layout", isArray: false, isComplex: true },
      { type: "int8", name: "data", isArray: true, isComplex: false },
    ],
  },
  "std_msgs/String": {
    name: "std_msgs/String",
    definitions: [{ type: "string", name: "data", isArray: false, isComplex: false }],
  },
  "std_msgs/Time": {
    name: "std_msgs/Time",
    definitions: [{ type: "time", name: "data", isArray: false, isComplex: false }],
  },
  "std_msgs/UInt16": {
    name: "std_msgs/UInt16",
    definitions: [{ type: "uint16", name: "data", isArray: false, isComplex: false }],
  },
  "std_msgs/UInt16MultiArray": {
    name: "std_msgs/UInt16MultiArray",
    definitions: [
      { type: "std_msgs/MultiArrayLayout", name: "layout", isArray: false, isComplex: true },
      { type: "uint16", name: "data", isArray: true, isComplex: false },
    ],
  },
  "std_msgs/UInt32": {
    name: "std_msgs/UInt32",
    definitions: [{ type: "uint32", name: "data", isArray: false, isComplex: false }],
  },
  "std_msgs/UInt32MultiArray": {
    name: "std_msgs/UInt32MultiArray",
    definitions: [
      { type: "std_msgs/MultiArrayLayout", name: "layout", isArray: false, isComplex: true },
      { type: "uint32", name: "data", isArray: true, isComplex: false },
    ],
  },
  "std_msgs/UInt64": {
    name: "std_msgs/UInt64",
    definitions: [{ type: "uint64", name: "data", isArray: false, isComplex: false }],
  },
  "std_msgs/UInt64MultiArray": {
    name: "std_msgs/UInt64MultiArray",
    definitions: [
      { type: "std_msgs/MultiArrayLayout", name: "layout", isArray: false, isComplex: true },
      { type: "uint64", name: "data", isArray: true, isComplex: false },
    ],
  },
  "std_msgs/UInt8": {
    name: "std_msgs/UInt8",
    definitions: [{ type: "uint8", name: "data", isArray: false, isComplex: false }],
  },
  "stereo_msgs/DisparityImage": {
    name: "stereo_msgs/DisparityImage",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "sensor_msgs/Image", name: "image", isArray: false, isComplex: true },
      { type: "float32", name: "f", isArray: false, isComplex: false },
      { type: "float32", name: "T", isArray: false, isComplex: false },
      {
        type: "sensor_msgs/RegionOfInterest",
        name: "valid_window",
        isArray: false,
        isComplex: true,
      },
      { type: "float32", name: "min_disparity", isArray: false, isComplex: false },
      { type: "float32", name: "max_disparity", isArray: false, isComplex: false },
      { type: "float32", name: "delta_d", isArray: false, isComplex: false },
    ],
  },
  "tf2_msgs/TFMessage": {
    name: "tf2_msgs/TFMessage",
    definitions: [
      {
        type: "geometry_msgs/TransformStamped",
        name: "transforms",
        isArray: true,
        isComplex: true,
      },
    ],
  },
  "trajectory_msgs/JointTrajectory": {
    name: "trajectory_msgs/JointTrajectory",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "string", name: "joint_names", isArray: true, isComplex: false },
      {
        type: "trajectory_msgs/JointTrajectoryPoint",
        name: "points",
        isArray: true,
        isComplex: true,
      },
    ],
  },
  "trajectory_msgs/JointTrajectoryPoint": {
    name: "trajectory_msgs/JointTrajectoryPoint",
    definitions: [
      { type: "float64", name: "positions", isArray: true, isComplex: false },
      { type: "float64", name: "velocities", isArray: true, isComplex: false },
      { type: "float64", name: "accelerations", isArray: true, isComplex: false },
      { type: "float64", name: "effort", isArray: true, isComplex: false },
      { type: "duration", name: "time_from_start", isArray: false, isComplex: false },
    ],
  },
  "trajectory_msgs/MultiDOFJointTrajectory": {
    name: "trajectory_msgs/MultiDOFJointTrajectory",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "string", name: "joint_names", isArray: true, isComplex: false },
      {
        type: "trajectory_msgs/MultiDOFJointTrajectoryPoint",
        name: "points",
        isArray: true,
        isComplex: true,
      },
    ],
  },
  "trajectory_msgs/MultiDOFJointTrajectoryPoint": {
    name: "trajectory_msgs/MultiDOFJointTrajectoryPoint",
    definitions: [
      { type: "geometry_msgs/Transform", name: "transforms", isArray: true, isComplex: true },
      { type: "geometry_msgs/Twist", name: "velocities", isArray: true, isComplex: true },
      { type: "geometry_msgs/Twist", name: "accelerations", isArray: true, isComplex: true },
      { type: "duration", name: "time_from_start", isArray: false, isComplex: false },
    ],
  },
  "visualization_msgs/ImageMarkerArray": {
    name: "visualization_msgs/ImageMarkerArray",
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
  "visualization_msgs/InteractiveMarker": {
    name: "visualization_msgs/InteractiveMarker",
    definitions: [
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "geometry_msgs/Pose", name: "pose", isArray: false, isComplex: true },
      { type: "string", name: "name", isArray: false, isComplex: false },
      { type: "string", name: "description", isArray: false, isComplex: false },
      { type: "float32", name: "scale", isArray: false, isComplex: false },
      {
        type: "visualization_msgs/MenuEntry",
        name: "menu_entries",
        isArray: true,
        isComplex: true,
      },
      {
        type: "visualization_msgs/InteractiveMarkerControl",
        name: "controls",
        isArray: true,
        isComplex: true,
      },
    ],
  },
  "visualization_msgs/MenuEntry": {
    name: "visualization_msgs/MenuEntry",
    definitions: [
      { type: "uint32", name: "id", isArray: false, isComplex: false },
      { type: "uint32", name: "parent_id", isArray: false, isComplex: false },
      { type: "string", name: "title", isArray: false, isComplex: false },
      { type: "string", name: "command", isArray: false, isComplex: false },
      { type: "uint8", name: "FEEDBACK", isConstant: true, value: 0 },
      { type: "uint8", name: "ROSRUN", isConstant: true, value: 1 },
      { type: "uint8", name: "ROSLAUNCH", isConstant: true, value: 2 },
      { type: "uint8", name: "command_type", isArray: false, isComplex: false },
    ],
  },
  "visualization_msgs/InteractiveMarkerControl": {
    name: "visualization_msgs/InteractiveMarkerControl",
    definitions: [
      { type: "string", name: "name", isArray: false, isComplex: false },
      { type: "geometry_msgs/Quaternion", name: "orientation", isArray: false, isComplex: true },
      { type: "uint8", name: "INHERIT", isConstant: true, value: 0 },
      { type: "uint8", name: "FIXED", isConstant: true, value: 1 },
      { type: "uint8", name: "VIEW_FACING", isConstant: true, value: 2 },
      { type: "uint8", name: "orientation_mode", isArray: false, isComplex: false },
      { type: "uint8", name: "NONE", isConstant: true, value: 0 },
      { type: "uint8", name: "MENU", isConstant: true, value: 1 },
      { type: "uint8", name: "BUTTON", isConstant: true, value: 2 },
      { type: "uint8", name: "MOVE_AXIS", isConstant: true, value: 3 },
      { type: "uint8", name: "MOVE_PLANE", isConstant: true, value: 4 },
      { type: "uint8", name: "ROTATE_AXIS", isConstant: true, value: 5 },
      { type: "uint8", name: "MOVE_ROTATE", isConstant: true, value: 6 },
      { type: "uint8", name: "MOVE_3D", isConstant: true, value: 7 },
      { type: "uint8", name: "ROTATE_3D", isConstant: true, value: 8 },
      { type: "uint8", name: "MOVE_ROTATE_3D", isConstant: true, value: 9 },
      { type: "uint8", name: "interaction_mode", isArray: false, isComplex: false },
      { type: "bool", name: "always_visible", isArray: false, isComplex: false },
      { type: "visualization_msgs/Marker", name: "markers", isArray: true, isComplex: true },
      { type: "bool", name: "independent_marker_orientation", isArray: false, isComplex: false },
      { type: "string", name: "description", isArray: false, isComplex: false },
    ],
  },
  "visualization_msgs/Marker": {
    name: "visualization_msgs/Marker",
    definitions: [
      { type: "uint8", name: "ARROW", isConstant: true, value: 0 },
      { type: "uint8", name: "CUBE", isConstant: true, value: 1 },
      { type: "uint8", name: "SPHERE", isConstant: true, value: 2 },
      { type: "uint8", name: "CYLINDER", isConstant: true, value: 3 },
      { type: "uint8", name: "LINE_STRIP", isConstant: true, value: 4 },
      { type: "uint8", name: "LINE_LIST", isConstant: true, value: 5 },
      { type: "uint8", name: "CUBE_LIST", isConstant: true, value: 6 },
      { type: "uint8", name: "SPHERE_LIST", isConstant: true, value: 7 },
      { type: "uint8", name: "POINTS", isConstant: true, value: 8 },
      { type: "uint8", name: "TEXT_VIEW_FACING", isConstant: true, value: 9 },
      { type: "uint8", name: "MESH_RESOURCE", isConstant: true, value: 10 },
      { type: "uint8", name: "TRIANGLE_LIST", isConstant: true, value: 11 },
      { type: "uint8", name: "ADD", isConstant: true, value: 0 },
      { type: "uint8", name: "MODIFY", isConstant: true, value: 0 },
      { type: "uint8", name: "DELETE", isConstant: true, value: 2 },
      { type: "uint8", name: "DELETEALL", isConstant: true, value: 3 },
      { type: "std_msgs/Header", name: "header", isArray: false, isComplex: true },
      { type: "string", name: "ns", isArray: false, isComplex: false },
      { type: "int32", name: "id", isArray: false, isComplex: false },
      { type: "int32", name: "type", isArray: false, isComplex: false },
      { type: "int32", name: "action", isArray: false, isComplex: false },
      { type: "geometry_msgs/Pose", name: "pose", isArray: false, isComplex: true },
      { type: "geometry_msgs/Vector3", name: "scale", isArray: false, isComplex: true },
      { type: "std_msgs/ColorRGBA", name: "color", isArray: false, isComplex: true },
      { type: "duration", name: "lifetime", isArray: false, isComplex: false },
      { type: "bool", name: "frame_locked", isArray: false, isComplex: false },
      { type: "geometry_msgs/Point", name: "points", isArray: true, isComplex: true },
      { type: "std_msgs/ColorRGBA", name: "colors", isArray: true, isComplex: true },
      { type: "string", name: "text", isArray: false, isComplex: false },
      { type: "string", name: "mesh_resource", isArray: false, isComplex: false },
      { type: "bool", name: "mesh_use_embedded_materials", isArray: false, isComplex: false },
    ],
  },
  "visualization_msgs/MarkerArray": {
    name: "visualization_msgs/MarkerArray",
    definitions: [
      { type: "visualization_msgs/Marker", name: "markers", isArray: true, isComplex: true },
    ],
  },
};

module.exports = { definitions };
