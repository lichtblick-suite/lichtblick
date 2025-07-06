import { jsx as _jsx } from "react/jsx-runtime";
import { fromSec } from "@lichtblick/rostime";
import PanelSetup from "@lichtblick/suite-base/stories/PanelSetup";
import { makePass, QUAT_IDENTITY, rad2deg, TEST_COLORS } from "./common";
import useDelayedFixture from "./useDelayedFixture";
import ThreeDeePanel from "../index";
const VEC3_ZERO = { x: 0, y: 0, z: 0 };
export default {
    title: "panels/ThreeDeeRender",
    component: ThreeDeePanel,
};
export const TransformInterpolation = {
    render: function Story() {
        const topics = [
            { name: "/markers", schemaName: "visualization_msgs/Marker" },
            { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
        ];
        const tf_t1 = {
            topic: "/tf",
            receiveTime: { sec: 10, nsec: 0 },
            message: {
                header: { seq: 0, stamp: { sec: 1, nsec: 0 }, frame_id: "map" },
                child_frame_id: "base_link",
                transform: {
                    translation: VEC3_ZERO,
                    rotation: QUAT_IDENTITY,
                },
            },
            schemaName: "geometry_msgs/TransformStamped",
            sizeInBytes: 0,
        };
        const tf_t3 = {
            topic: "/tf",
            receiveTime: { sec: 10, nsec: 0 },
            message: {
                header: { seq: 0, stamp: { sec: 3, nsec: 0 }, frame_id: "map" },
                child_frame_id: "base_link",
                transform: {
                    translation: { x: 2, y: 0, z: 0 },
                    rotation: QUAT_IDENTITY,
                },
            },
            schemaName: "geometry_msgs/TransformStamped",
            sizeInBytes: 0,
        };
        const pass1 = makePass({
            id: 1,
            frame_id: "base_link",
            stamp: fromSec(1),
            colorHex: TEST_COLORS.MARKER_GREEN1,
        });
        const pass2 = makePass({
            id: 2,
            frame_id: "base_link",
            stamp: fromSec(1),
            colorHex: TEST_COLORS.MARKER_GREEN2,
            frame_locked: true,
        });
        const pass3 = makePass({
            id: 3,
            frame_id: "base_link",
            stamp: fromSec(2),
            colorHex: TEST_COLORS.MARKER_GREEN3,
            pose: { position: { x: 1, y: 0, z: 0 }, orientation: QUAT_IDENTITY },
        });
        const fixture = useDelayedFixture({
            topics,
            frame: {
                "/markers": [pass1, pass2, pass3],
                "/tf": [tf_t1, tf_t3],
            },
            capabilities: [],
            activeData: {
                currentTime: { sec: 2, nsec: 0 },
            },
        });
        return (_jsx(PanelSetup, { fixture: fixture, children: _jsx(ThreeDeePanel, { overrideConfig: {
                    followTf: "base_link",
                    layers: {
                        grid: {
                            layerId: "foxglove.Grid",
                            position: [0, 0, -0.25],
                        },
                    },
                    cameraState: {
                        distance: 3,
                        perspective: true,
                        phi: rad2deg(1),
                        targetOffset: [0, 0, 0],
                        thetaOffset: rad2deg(0),
                        fovy: rad2deg(0.75),
                        near: 0.01,
                        far: 5000,
                        target: [0, 0, 0],
                        targetOrientation: [0, 0, 0, 1],
                    },
                    topics: {
                        "/markers": { visible: true },
                    },
                } }) }));
    },
    parameters: { colorScheme: "dark" },
};
export const TransformOffsets = {
    render: function Story() {
        const topics = [
            { name: "/markers", schemaName: "visualization_msgs/Marker" },
            { name: "/tf", schemaName: "geometry_msgs/TransformStamped" },
        ];
        const tf_ab = {
            topic: "/tf",
            receiveTime: { sec: 10, nsec: 0 },
            message: {
                header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "a" },
                child_frame_id: "b",
                transform: {
                    translation: { x: -1, y: 0, z: 0 },
                    rotation: QUAT_IDENTITY,
                },
            },
            schemaName: "geometry_msgs/TransformStamped",
            sizeInBytes: 0,
        };
        const tf_bc = {
            topic: "/tf",
            receiveTime: { sec: 10, nsec: 0 },
            message: {
                header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "b" },
                child_frame_id: "c",
                transform: {
                    translation: { x: -1, y: 0, z: 0 },
                    rotation: QUAT_IDENTITY,
                },
            },
            schemaName: "geometry_msgs/TransformStamped",
            sizeInBytes: 0,
        };
        const tf_cd = {
            topic: "/tf",
            receiveTime: { sec: 10, nsec: 0 },
            message: {
                header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "c" },
                child_frame_id: "d",
                transform: {
                    translation: { x: -1, y: 0, z: 0 },
                    rotation: QUAT_IDENTITY,
                },
            },
            schemaName: "geometry_msgs/TransformStamped",
            sizeInBytes: 0,
        };
        const pass1 = makePass({
            id: 1,
            frame_id: "d",
            stamp: fromSec(1),
            frame_locked: true,
            colorHex: TEST_COLORS.MARKER_GREEN1,
        });
        const fixture = useDelayedFixture({
            topics,
            frame: {
                "/markers": [pass1],
                "/tf": [tf_ab, tf_bc, tf_cd],
            },
            capabilities: [],
            activeData: {
                currentTime: { sec: 2, nsec: 0 },
            },
        });
        return (_jsx(PanelSetup, { fixture: fixture, children: _jsx(ThreeDeePanel, { overrideConfig: {
                    followTf: "b",
                    layers: {
                        grid: {
                            layerId: "foxglove.Grid",
                            position: [0, 0, -0.25],
                            frameId: "a",
                        },
                    },
                    scene: {
                        transforms: {
                            editable: true,
                        },
                    },
                    transforms: {
                        "frame:b": {
                            xyzOffset: [0, 1, 0],
                            rpyCoefficient: [45, 0, 0],
                        },
                        "frame:c": {
                            xyzOffset: [0, 1, 0],
                            rpyCoefficient: [-45, 0, 0],
                        },
                        "frame:d": {
                            xyzOffset: [0, 1, 0],
                        },
                    },
                    cameraState: {
                        perspective: true,
                        distance: 5,
                        phi: 36,
                        thetaOffset: 0,
                        targetOffset: [-0.1, 0.5, 0],
                        target: [0, 0, 0],
                        targetOrientation: [0, 0, 0, 1],
                        fovy: 45,
                        near: 0.01,
                        far: 5000,
                    },
                    topics: {
                        "/markers": { visible: true },
                    },
                } }) }));
    },
    parameters: { colorScheme: "dark" },
};
