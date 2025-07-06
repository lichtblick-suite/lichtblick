import type { Time } from "@lichtblick/rostime";
import type { Pose } from "./transforms";
export type Matrix3 = [number, number, number, number, number, number, number, number, number];
export type Matrix3x4 = [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
];
export type Matrix6 = [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number
];
export declare enum MarkerType {
    ARROW = 0,
    CUBE = 1,
    SPHERE = 2,
    CYLINDER = 3,
    LINE_STRIP = 4,
    LINE_LIST = 5,
    CUBE_LIST = 6,
    SPHERE_LIST = 7,
    POINTS = 8,
    TEXT_VIEW_FACING = 9,
    MESH_RESOURCE = 10,
    TRIANGLE_LIST = 11
}
export declare enum MarkerAction {
    ADD = 0,
    MODIFY = 0,
    DELETE = 2,
    DELETEALL = 3
}
export declare enum PointFieldType {
    UNKNOWN = 0,
    INT8 = 1,
    UINT8 = 2,
    INT16 = 3,
    UINT16 = 4,
    INT32 = 5,
    UINT32 = 6,
    FLOAT32 = 7,
    FLOAT64 = 8
}
export type RosTime = Time;
export type RosDuration = RosTime;
export type Vector2 = {
    x: number;
    y: number;
};
export type Vector3 = {
    x: number;
    y: number;
    z: number;
};
export type Point = Vector3;
export type Point32 = Vector3;
export type Quaternion = {
    x: number;
    y: number;
    z: number;
    w: number;
};
export type ColorRGB = {
    r: number;
    g: number;
    b: number;
};
export type ColorRGBA = {
    r: number;
    g: number;
    b: number;
    a: number;
};
export type PoseWithCovariance = {
    pose: Pose;
    covariance: Matrix6;
};
export type Polygon = {
    points: Point32[];
};
export type Header = {
    frame_id: string;
    stamp: RosTime;
    seq?: number;
};
export type Transform = {
    translation: Vector3;
    rotation: Quaternion;
};
export type TransformStamped = {
    header: Header;
    child_frame_id: string;
    transform: Transform;
};
export type TFMessage = {
    transforms: TransformStamped[];
};
export type Marker = {
    header: Header;
    ns: string;
    id: number;
    type: number;
    action: number;
    pose: Pose;
    scale: Vector3;
    color: ColorRGBA;
    lifetime: RosDuration;
    frame_locked: boolean;
    points: Vector3[];
    colors: ColorRGBA[];
    text: string;
    mesh_resource: string;
    mesh_use_embedded_materials: boolean;
};
export type MarkerArray = {
    markers: Marker[];
};
export type PointField = {
    name: string;
    offset: number;
    datatype: number;
    count: number;
};
export type PointCloud2 = {
    header: Header;
    height: number;
    width: number;
    fields: PointField[];
    is_bigendian: boolean;
    point_step: number;
    row_step: number;
    data: Uint8Array;
    is_dense: boolean;
};
export type LaserScan = {
    header: Header;
    angle_min: number;
    angle_max: number;
    angle_increment: number;
    time_increment: number;
    scan_time: number;
    range_min: number;
    range_max: number;
    ranges: Float32Array;
    intensities: Float32Array;
};
export type MapMetaData = {
    map_load_time: RosTime;
    resolution: number;
    width: number;
    height: number;
    origin: Pose;
};
export type OccupancyGrid = {
    header: Header;
    info: MapMetaData;
    data: Int8Array | number[];
};
export type PoseStamped = {
    header: Header;
    pose: Pose;
};
export type PoseArray = Readonly<{
    header: Header;
    poses: Pose[];
}>;
export type NavPath = Readonly<{
    header: Header;
    poses: PoseStamped[];
}>;
export type PolygonStamped = {
    header: Header;
    polygon: Polygon;
};
export type PoseWithCovarianceStamped = {
    header: Header;
    pose: PoseWithCovariance;
};
export type RegionOfInterest = {
    x_offset: number;
    y_offset: number;
    height: number;
    width: number;
    do_rectify: boolean;
};
export type CameraInfo = {
    header: Header;
    height: number;
    width: number;
    distortion_model: string;
    D: number[];
    K: Matrix3 | [];
    R: Matrix3 | [];
    P: Matrix3x4 | [];
    binning_x: number;
    binning_y: number;
    roi: RegionOfInterest;
};
export type IncomingCameraInfo = {
    header: Header;
    height: number;
    width: number;
    distortion_model: string;
    D: number[] | undefined;
    K: Matrix3 | [] | undefined;
    R: Matrix3 | [] | undefined;
    P: Matrix3x4 | [] | undefined;
    d: number[] | undefined;
    k: Matrix3 | [] | undefined;
    r: Matrix3 | [] | undefined;
    p: Matrix3x4 | [] | undefined;
    binning_x: number;
    binning_y: number;
    roi: RegionOfInterest;
};
export type Image = {
    header: Header;
    height: number;
    width: number;
    encoding: string;
    is_bigendian: boolean;
    step: number;
    data: Int8Array | Uint8Array;
};
export type CompressedImage = {
    header: Header;
    format: string;
    data: Uint8Array;
};
export type JointState = {
    header: Header;
    name: string[];
    position: number[];
    velocity: number[];
    effort: number[];
};
export declare const TIME_ZERO: {
    sec: number;
    nsec: number;
};
export declare const TRANSFORM_STAMPED_DATATYPES: Set<string>;
export declare const TF_DATATYPES: Set<string>;
export declare const MARKER_DATATYPES: Set<string>;
export declare const MARKER_ARRAY_DATATYPES: Set<string>;
export declare const OCCUPANCY_GRID_DATATYPES: Set<string>;
export declare const POINTCLOUD_DATATYPES: Set<string>;
export declare const LASERSCAN_DATATYPES: Set<string>;
export declare const VELODYNE_SCAN_DATATYPES: Set<string>;
export declare const POSE_STAMPED_DATATYPES: Set<string>;
export declare const POSE_WITH_COVARIANCE_STAMPED_DATATYPES: Set<string>;
export declare const POSE_ARRAY_DATATYPES: Set<string>;
export declare const NAV_PATH_DATATYPES: Set<string>;
export declare const CAMERA_INFO_DATATYPES: Set<string>;
export declare const IMAGE_DATATYPES: Set<string>;
export declare const COMPRESSED_IMAGE_DATATYPES: Set<string>;
export declare const POLYGON_STAMPED_DATATYPES: Set<string>;
export declare const JOINTSTATE_DATATYPES: Set<string>;
export declare const IMAGE_MARKER_DATATYPES: Set<string>;
/** Not a real type offered by ROS, but historically Studio has supported it */
export declare const IMAGE_MARKER_ARRAY_DATATYPES: Set<string>;
