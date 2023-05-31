// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { t } from "i18next";
import { cloneDeep, set } from "lodash";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

import { SettingsTreeAction } from "@foxglove/studio";
import { ICameraHandler } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/ICameraHandler";
import {
  AnyFrameId,
  CoordinateFrame,
  Pose,
  UserFrameId,
  makePose,
} from "@foxglove/studio-base/panels/ThreeDeeRender/transforms";

import type { FollowMode, IRenderer } from "../IRenderer";
import { SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import { CameraState, DEFAULT_CAMERA_STATE } from "../camera";
import { PRECISION_DEGREES, PRECISION_DISTANCE } from "../settings";

const DISPLAY_FRAME_NOT_FOUND = "DISPLAY_FRAME_NOT_FOUND";

const UNIT_X = new THREE.Vector3(1, 0, 0);
const UNIT_Z = new THREE.Vector3(0, 0, 1);
const PI_2 = Math.PI / 2;

// used for holding unfollowPoseSnapshot in render frame every new frame
const snapshotInRenderFrame = makePose();

const tempVec3 = new THREE.Vector3();

const tempSpherical = new THREE.Spherical();
const tempEuler = new THREE.Euler();
const FOLLOW_TF_PATH = ["general", "followTf"];
export class CameraStateSettings extends SceneExtension implements ICameraHandler {
  // The frameId's of the fixed and render frames used to create the current unfollowPoseSnapshot
  #unfollowSnapshotFrameIds:
    | {
        render: UserFrameId;
        fixed: UserFrameId;
      }
    | undefined;

  // The pose of the render frame in the fixed frame when following was disabled
  // This is used to position and orient the camera from the fixed frame in the render frame
  public unfollowPoseSnapshot: Pose | undefined;

  #controls: OrbitControls;
  #isUpdatingCameraState = false;
  #canvas: HTMLCanvasElement;

  // This group is used to transform the cameras based on the Frame follow mode
  // quaternion is affected in stationary and position-only follow modes
  // both position and quaternion of the group are affected in stationary mode
  #cameraGroup: THREE.Group;
  #perspectiveCamera: THREE.PerspectiveCamera;
  #orthographicCamera: THREE.OrthographicCamera;
  #aspect: number;

  public constructor(renderer: IRenderer, canvas: HTMLCanvasElement, aspect: number) {
    super("foxglove.CameraStateSettings", renderer);

    // for Frame settings, we need to listen to the transform tree to update settings when new possible display frames are present
    renderer.on("transformTreeUpdated", this.#handleTransformTreeUpdated);

    renderer.on("cameraMove", this.#handleCameraMove);

    renderer.settings.errors.on("update", this.#handleErrorChange);
    renderer.settings.errors.on("clear", this.#handleErrorChange);
    renderer.settings.errors.on("remove", this.#handleErrorChange);

    this.#canvas = canvas;
    this.#perspectiveCamera = new THREE.PerspectiveCamera();
    this.#orthographicCamera = new THREE.OrthographicCamera();
    this.#cameraGroup = new THREE.Group();

    this.#cameraGroup.add(this.#perspectiveCamera);
    this.#cameraGroup.add(this.#orthographicCamera);
    this.add(this.#cameraGroup);

    this.#controls = new OrbitControls(this.#perspectiveCamera, this.#canvas);
    this.#controls.screenSpacePanning = false; // only allow panning in the XY plane
    this.#controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    this.#controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    this.#controls.touches.ONE = THREE.TOUCH.PAN;
    this.#controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    this.#controls.addEventListener("change", () => {
      if (!this.#isUpdatingCameraState) {
        renderer.emit("cameraMove", renderer);
      }
    });

    // Make the canvas able to receive keyboard events and setup WASD controls
    canvas.tabIndex = 1000;
    this.#aspect = aspect;
    this.#controls.keys = { LEFT: "KeyA", RIGHT: "KeyD", UP: "KeyW", BOTTOM: "KeyS" };
    this.#controls.listenToKeyEvents(canvas);
  }

  public override dispose(): void {
    // for camera settings
    this.renderer.off("cameraMove", this.#handleCameraMove);

    // for frame settings
    this.renderer.off("transformTreeUpdated", this.#handleTransformTreeUpdated);

    this.renderer.settings.errors.off("update", this.#handleErrorChange);
    this.renderer.settings.errors.off("clear", this.#handleErrorChange);
    this.renderer.settings.errors.off("remove", this.#handleErrorChange);

    super.dispose();
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    return [this.#cameraSettingsNode(), this.#frameSettingsNode()];
  }

  #cameraSettingsNode(): SettingsTreeEntry {
    const config = this.renderer.config;
    const { cameraState: camera } = config;
    const handler = this.handleSettingsAction;

    return {
      path: ["cameraState"],
      node: {
        label: t("threeDee:view"),
        actions: [{ type: "action", id: "reset-camera", label: t("threeDee:reset") }],
        handler,
        fields: {
          syncCamera: {
            label: t("threeDee:syncCamera"),
            input: "boolean",
            error: this.renderer.cameraSyncError(),
            value: config.scene.syncCamera ?? false,
            help: t("threeDee:syncCameraHelp"),
          },
          distance: {
            label: t("threeDee:distance"),
            input: "number",
            step: 1,
            precision: PRECISION_DISTANCE,
            value: camera.distance,
          },
          perspective: {
            label: t("threeDee:perspective"),
            input: "boolean",
            value: camera.perspective,
          },
          targetOffset: {
            label: t("threeDee:target"),
            input: "vec3",
            labels: ["X", "Y", "Z"],
            precision: PRECISION_DISTANCE,
            value: [...camera.targetOffset],
          },
          thetaOffset: {
            label: t("threeDee:theta"),
            input: "number",
            step: 1,
            precision: PRECISION_DEGREES,
            value: camera.thetaOffset,
          },
          ...(camera.perspective && {
            phi: {
              label: t("threeDee:phi"),
              input: "number",
              step: 1,
              precision: PRECISION_DEGREES,
              value: camera.phi,
            },
            fovy: {
              label: t("threeDee:fovy"),
              input: "number",
              step: 1,
              precision: PRECISION_DEGREES,
              value: camera.fovy,
            },
          }),
          near: {
            label: t("threeDee:near"),
            input: "number",
            step: DEFAULT_CAMERA_STATE.near,
            precision: PRECISION_DISTANCE,
            value: camera.near,
          },
          far: {
            label: t("threeDee:far"),
            input: "number",
            step: 1,
            precision: PRECISION_DISTANCE,
            value: camera.far,
          },
        },
      },
    };
  }

  #frameSettingsNode(): SettingsTreeEntry {
    const config = this.renderer.config;
    const handler = this.handleSettingsAction;

    // If the user-selected frame does not exist, show it in the dropdown
    // anyways. A settings node error will be displayed
    let followTfOptions = this.renderer.coordinateFrameList;
    const followFrameId = this.renderer.followFrameId;

    this.#updateFollowTfError();

    // always show current config value if it exists
    const followTfValue = config.followTf ?? followFrameId;
    if (followTfValue != undefined && !this.renderer.transformTree.hasFrame(followTfValue)) {
      followTfOptions = [
        { label: CoordinateFrame.DisplayName(followTfValue), value: followTfValue },
        ...followTfOptions,
      ];
    }

    const followTfError = this.renderer.settings.errors.errors.errorAtPath(FOLLOW_TF_PATH);

    const followModeOptions = [
      { label: t("threeDee:pose"), value: "follow-pose" },
      { label: t("threeDee:position"), value: "follow-position" },
      { label: t("threeDee:fixed"), value: "follow-none" },
    ];
    const followModeValue = this.renderer.config.followMode;

    return {
      path: ["general"],
      node: {
        label: t("threeDee:frame"),
        fields: {
          followTf: {
            label: t("threeDee:displayFrame"),
            help: t("threeDee:displayFrameHelp"),
            input: "select",
            options: followTfOptions,
            value: followTfValue,
            error: followTfError,
          },
          followMode: {
            label: t("threeDee:followMode"),
            help: t("threeDee:followModeHelp"),
            input: "select",
            options: followModeOptions,
            value: followModeValue,
          },
        },
        defaultExpansionState: "expanded",
        handler,
      },
    };
  }
  public override handleSettingsAction = (action: SettingsTreeAction): void => {
    if (action.action === "perform-node-action" && action.payload.id === "reset-camera") {
      this.renderer.updateConfig((draft) => {
        draft.cameraState = cloneDeep(DEFAULT_CAMERA_STATE);
      });
      this.updateSettingsTree();
      return;
    }

    if (action.action !== "update" || action.payload.path.length === 0) {
      return;
    }

    const {
      path: [category],
      path,
      value,
    } = action.payload;

    // camera settings
    if (category === "cameraState") {
      if (path[1] === "syncCamera") {
        // Update the configuration. This is done manually since syncCamera is under `scene`, not `cameraState`
        this.renderer.updateConfig((draft) => {
          draft.scene.syncCamera = value as boolean;
        });
      } else {
        this.renderer.updateConfig((draft) => set(draft, path, value));
      }

      this.updateSettingsTree();
    }

    // frame settings
    if (category === "general") {
      if (path[1] === "followTf") {
        const followTf = value as string | undefined;
        // Update the configuration. This is done manually since followTf is at the top level of
        // config, not under `general`
        this.renderer.updateConfig((draft) => {
          draft.followTf = followTf;
        });

        this.#updateFollowFrameId();
        this.renderer.settings.errors.clearPath(["general", "followTf"]);
      } else if (path[1] === "followMode") {
        const followMode = value as FollowMode;
        // Update the configuration. This is done manually since followMode is at the top level of
        // config, not under `general`
        this.renderer.updateConfig((draft) => {
          // any follow -> stationary no clear
          // stationary -> any follow clear offset (center on frame)
          if (draft.followMode === "follow-none") {
            draft.cameraState.targetOffset = [...DEFAULT_CAMERA_STATE.targetOffset];
            draft.cameraState.thetaOffset = DEFAULT_CAMERA_STATE.thetaOffset;
          } else if (followMode === "follow-pose") {
            draft.cameraState.thetaOffset = DEFAULT_CAMERA_STATE.thetaOffset;
          }
          draft.followMode = followMode;
        });
      }

      this.updateSettingsTree();
    }
  };

  // this extension has  NO RENDERABLES so the parent startFrame would do nothing
  public override startFrame(
    currentTime: bigint,
    renderFrameId: AnyFrameId,
    fixedFrameId: AnyFrameId,
  ): void {
    const followMode = this.renderer.config.followMode;

    if (
      followMode === "follow-pose" ||
      // we don't need the unfollow pose snapshot when there are no transforms
      fixedFrameId === CoordinateFrame.FALLBACK_FRAME_ID ||
      renderFrameId === CoordinateFrame.FALLBACK_FRAME_ID
    ) {
      this.#unfollowSnapshotFrameIds = undefined;
      this.unfollowPoseSnapshot = undefined;
      this.#cameraGroup.position.set(0, 0, 0);
      this.#cameraGroup.quaternion.set(0, 0, 0, 1);
      return;
    }

    const poseSnapshot = this.#getUnfollowPoseSnapshot(fixedFrameId, renderFrameId, currentTime);

    const transformTree = this.renderer.transformTree;

    if (poseSnapshot) {
      // transform position of snapshot in fixed frame to the render frame
      const appliedTransform = Boolean(
        transformTree.apply(
          snapshotInRenderFrame,
          poseSnapshot,
          renderFrameId,
          fixedFrameId,
          fixedFrameId,
          currentTime,
          currentTime,
        ),
      );

      if (!appliedTransform) {
        return;
      }
      /**
       * the application of the unfollowPoseSnapshot position and orientation
       * components makes the camera position and rotation static relative to the fixed frame.
       * So when the display frame changes the angle of the camera relative
       * to the scene will not change because only the snapshotPose orientation is applied
       */
      if (followMode === "follow-position") {
        // only make orientation static/stationary in this mode
        // the position still follows the frame
        this.#cameraGroup.position.set(0, 0, 0);
      } else {
        this.#cameraGroup.position.set(
          snapshotInRenderFrame.position.x,
          snapshotInRenderFrame.position.y,
          snapshotInRenderFrame.position.z,
        );
      }
      // this negates the rotation of the changes in renderFrame
      this.#cameraGroup.quaternion.set(
        snapshotInRenderFrame.orientation.x,
        snapshotInRenderFrame.orientation.y,
        snapshotInRenderFrame.orientation.z,
        snapshotInRenderFrame.orientation.w,
      );
    }
  }

  #handleCameraMove = (): void => {
    this.updateSettingsTree();
  };

  #handleTransformTreeUpdated = (): void => {
    this.#updateFollowFrameId();
    this.updateSettingsTree();
  };

  #updateFollowFrameId() {
    const { followTf } = this.renderer.config;
    const { transformTree } = this.renderer;
    this.#updateFollowTfError();

    const followTfFrameExists = followTf != undefined && transformTree.hasFrame(followTf);
    if (followTfFrameExists) {
      this.renderer.setFollowFrameId(followTf);
      return;
    }

    // No valid renderFrameId set, or new frames have been added, fall back to selecting the
    // heuristically most valid frame (if any frames are present)
    const followFrameId = transformTree.getDefaultFollowFrameId();
    this.renderer.setFollowFrameId(followFrameId);
  }

  #updateFollowTfError = (): void => {
    const { followTf } = this.renderer.config;
    const { transformTree } = this.renderer;

    if (followTf != undefined) {
      const followTfFrameExists = transformTree.hasFrame(followTf);
      if (followTfFrameExists) {
        this.renderer.settings.errors.remove(FOLLOW_TF_PATH, DISPLAY_FRAME_NOT_FOUND);
      } else {
        this.renderer.settings.errors.add(
          FOLLOW_TF_PATH,
          DISPLAY_FRAME_NOT_FOUND,
          t("threeDee:frameNotFound", {
            frameId: followTf,
          }),
        );
      }
    }
  };

  #handleErrorChange = (): void => {
    this.updateSettingsTree();
  };

  // Redefine follow pose snapshot whenever renderFrame or fixedFrame changes
  #getUnfollowPoseSnapshot(fixedFrameId: string, renderFrameId: string, currentTime: bigint) {
    const transformTree = this.renderer.transformTree;
    if (
      this.#unfollowSnapshotFrameIds?.fixed !== fixedFrameId ||
      this.#unfollowSnapshotFrameIds.render !== renderFrameId
    ) {
      this.unfollowPoseSnapshot = makePose();
      // record the pose of the center of the render frame in fixed frame into the snapshot
      transformTree.apply(
        this.unfollowPoseSnapshot,
        this.unfollowPoseSnapshot,
        fixedFrameId,
        fixedFrameId,
        renderFrameId,
        currentTime,
        currentTime,
      );
      this.#unfollowSnapshotFrameIds = {
        fixed: fixedFrameId,
        render: renderFrameId,
      };
    }
    return this.unfollowPoseSnapshot;
  }

  public getActiveCamera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.renderer.config.cameraState.perspective
      ? this.#perspectiveCamera
      : this.#orthographicCamera;
  }

  public handleResize(width: number, height: number, _pixelRatio: number): void {
    this.#aspect = width / height;
    this.setCameraState(this.renderer.config.cameraState);
  }

  public getCameraState(): CameraState {
    const config = this.renderer.config;
    return {
      perspective: config.cameraState.perspective,
      distance: this.#controls.getDistance(),
      phi: THREE.MathUtils.radToDeg(this.#controls.getPolarAngle()),
      thetaOffset: THREE.MathUtils.radToDeg(-this.#controls.getAzimuthalAngle()),
      targetOffset: [this.#controls.target.x, this.#controls.target.y, this.#controls.target.z],
      target: config.cameraState.target,
      targetOrientation: config.cameraState.targetOrientation,
      fovy: config.cameraState.fovy,
      near: config.cameraState.near,
      far: config.cameraState.far,
    };
  }

  public setCameraState(cameraState: CameraState): void {
    this.#isUpdatingCameraState = true;
    this.#updateCameras(cameraState);
    // only active for follow pose mode because it introduces strange behavior into the other modes
    // due to the fact that they are manipulating the camera after update with the `cameraGroup`
    if (this.renderer.config.followMode === "follow-pose") {
      this.#controls.update();
    }
    this.#isUpdatingCameraState = false;
  }

  /** Translate a CameraState to the three.js coordinate system */
  #updateCameras(cameraState: CameraState): void {
    const targetOffset = tempVec3;
    const config = this.renderer.config;
    targetOffset.fromArray(cameraState.targetOffset);

    const phi = THREE.MathUtils.degToRad(cameraState.phi);
    const theta = -THREE.MathUtils.degToRad(cameraState.thetaOffset);

    // Always update the perspective camera even if the current mode is orthographic. This is needed
    // to make the OrbitControls work properly since they track the perspective camera.
    // https://github.com/foxglove/studio/issues/4138

    // Convert the camera spherical coordinates (radius, phi, theta) to Cartesian (X, Y, Z)
    tempSpherical.set(cameraState.distance, phi, theta);
    this.#perspectiveCamera.position.setFromSpherical(tempSpherical).applyAxisAngle(UNIT_X, PI_2);
    this.#perspectiveCamera.position.add(targetOffset);

    // Convert the camera spherical coordinates (phi, theta) to a quaternion rotation
    this.#perspectiveCamera.quaternion.setFromEuler(tempEuler.set(phi, 0, theta, "ZYX"));
    this.#perspectiveCamera.fov = cameraState.fovy;
    this.#perspectiveCamera.near = cameraState.near;
    this.#perspectiveCamera.far = cameraState.far;
    this.#perspectiveCamera.aspect = this.#aspect;
    this.#perspectiveCamera.updateProjectionMatrix();

    this.#controls.target.copy(targetOffset);

    if (cameraState.perspective) {
      // Unlock the polar angle (pitch axis)
      this.#controls.minPolarAngle = 0;
      this.#controls.maxPolarAngle = Math.PI;
    } else {
      // Lock the polar angle during 2D mode
      const curPolarAngle = THREE.MathUtils.degToRad(config.cameraState.phi);
      this.#controls.minPolarAngle = this.#controls.maxPolarAngle = curPolarAngle;

      this.#orthographicCamera.position.set(targetOffset.x, targetOffset.y, cameraState.far / 2);
      this.#orthographicCamera.quaternion.setFromAxisAngle(UNIT_Z, theta);
      this.#orthographicCamera.left = (-cameraState.distance / 2) * this.#aspect;
      this.#orthographicCamera.right = (cameraState.distance / 2) * this.#aspect;
      this.#orthographicCamera.top = cameraState.distance / 2;
      this.#orthographicCamera.bottom = -cameraState.distance / 2;
      this.#orthographicCamera.near = cameraState.near;
      this.#orthographicCamera.far = cameraState.far;
      this.#orthographicCamera.updateProjectionMatrix();
    }
  }
}
