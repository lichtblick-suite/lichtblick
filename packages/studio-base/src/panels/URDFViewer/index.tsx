// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Alert, Button, Link } from "@mui/material";
import { differenceBy, first, isEmpty } from "lodash";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useResizeDetector } from "react-resize-detector";
import { usePrevious } from "react-use";
import * as THREE from "three";
import { makeStyles } from "tss-react/mui";

import * as PanelAPI from "@foxglove/studio-base/PanelAPI";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import { useAssets } from "@foxglove/studio-base/context/AssetsContext";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import { JointState } from "@foxglove/studio-base/types/Messages";
import { SaveConfig } from "@foxglove/studio-base/types/panels";

import { Renderer } from "./Renderer";
import { defaultConfig } from "./defaultConfig";
import { useURDFViewerSettings } from "./settings";
import { Config } from "./types";
import useRobotDescriptionAsset from "./useRobotDescriptionAsset";

type Props = {
  config: Config;
  saveConfig: SaveConfig<Config>;
};

const useStyles = makeStyles()((theme) => ({
  root: {
    display: "flex",
    flexDirection: "column",
    flex: "auto",
    overflow: "hidden",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
  viewer: {
    display: "flex",
    flex: "auto",
    overflow: "hidden",
  },
  inner: {
    flex: "auto",
    position: "relative",
  },
  canvasWrapper: {
    position: "absolute",
    inset: 0,
  },
  recenterButton: {
    bottom: theme.spacing(1),
    right: theme.spacing(1),
    position: "absolute",
  },
}));

function URDFViewer({ config, saveConfig }: Props) {
  const { classes } = useStyles();
  const { customJointValues, jointStatesTopic, opacity, selectedAssetId } = config;
  const [canvas, setCanvas] = useState<HTMLCanvasElement | ReactNull>(ReactNull);

  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // an existing resize observation.
  // https://github.com/maslianok/react-resize-detector/issues/45
  const {
    ref: resizeRef,
    width,
    height,
  } = useResizeDetector({
    refreshRate: 0,
    refreshMode: "debounce",
  });
  const { assets } = useAssets();

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const urdfAssets = useMemo(() => assets.filter((asset) => asset.type === "urdf"), [assets]);

  const model = useMemo(() => {
    if (selectedAssetId) {
      return urdfAssets.find((asset) => asset.uuid === selectedAssetId)?.model;
    } else {
      return urdfAssets[0]?.model;
    }
  }, [urdfAssets, selectedAssetId]);

  // Automatically select newly added URDF assets
  const prevAssets = usePrevious(urdfAssets);
  useEffect(() => {
    const newAsset = first(differenceBy(urdfAssets, prevAssets ?? [], (asset) => asset.uuid));
    if (newAsset) {
      saveConfig({ selectedAssetId: newAsset.uuid });
    }
  }, [urdfAssets, saveConfig, prevAssets]);

  const [renderer] = useState(() => new Renderer());

  useEffect(() => {
    return () => {
      renderer.dispose();
    };
  }, [renderer]);

  useLayoutEffect(() => {
    if (canvas) {
      renderer.setCanvas(canvas);
    }
  }, [canvas, renderer]);

  useLayoutEffect(() => {
    if (width != undefined && height != undefined) {
      renderer.setSize(width, height);
    }
  }, [width, height, renderer]);

  useLayoutEffect(() => {
    renderer.setModel(model);
  }, [renderer, model]);

  const { [jointStatesTopic ?? ""]: [latestJointStatesMessage] = [] } = PanelAPI.useMessagesByTopic(
    {
      topics: jointStatesTopic != undefined ? [jointStatesTopic] : [],
      historySize: 1,
    },
  ) as Record<string, readonly MessageEvent<JointState>[]>;

  const manualJointControl = isEmpty(config.jointStatesTopic);

  const jointValues = useMemo(() => {
    if (manualJointControl) {
      return customJointValues;
    }
    const values: Record<string, number> = {};
    const jointState = latestJointStatesMessage?.message;
    if (jointState) {
      jointState.name.forEach((name, index) => {
        const position = jointState.position[index];
        if (position != undefined) {
          values[name] = position;
        }
      });
    }
    return values;
  }, [customJointValues, manualJointControl, latestJointStatesMessage?.message]);

  useLayoutEffect(() => {
    if (jointValues) {
      renderer.setJointValues(jointValues);
    }
  }, [jointValues, renderer]);

  useLayoutEffect(() => {
    if (opacity != undefined) {
      renderer.setOpacity(opacity);
    }
  }, [renderer, opacity]);

  const [cameraCenter, setCameraCenter] = useState(() => new THREE.Vector3(0, 0, 0));
  const cameraCentered = cameraCenter.x === 0 && cameraCenter.y === 0 && cameraCenter.z === 0;
  useEffect(() => {
    const listener = (center: THREE.Vector3) => {
      setCameraCenter(center.clone());
    };
    renderer.addListener("cameraMove", listener);
    return () => {
      renderer.removeListener("cameraMove", listener);
    };
  });

  useLayoutEffect(() => {
    renderer.render();
  });

  const { messageBar } = useRobotDescriptionAsset();

  useURDFViewerSettings(config, saveConfig, model);

  return (
    <div className={classes.root}>
      <PanelToolbar />
      <Alert severity="warning">
        The URDF Viewer panel is deprecated. See the{" "}
        <Link
          href="https://foxglove.dev/docs/studio/panels/3d#add-unified-robot-description-format-urdf"
          target="_blank"
        >
          3D panel docs
        </Link>{" "}
        to visualize URDFs.
      </Alert>
      <div className={classes.content}>
        {messageBar}
        {model == undefined ? (
          <EmptyState>Drag and drop a URDF file to visualize it.</EmptyState>
        ) : (
          <div className={classes.viewer}>
            <div className={classes.inner} ref={resizeRef}>
              <div className={classes.canvasWrapper}>
                <canvas ref={(el) => setCanvas(el)} width={width} height={height} />
              </div>
              {!cameraCentered && (
                <Button
                  className={classes.recenterButton}
                  onClick={() => {
                    renderer.centerCamera();
                  }}
                  variant="contained"
                >
                  Re-center
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Panel(
  Object.assign(URDFViewer, {
    panelType: "URDFViewer",
    defaultConfig,
  }),
);
