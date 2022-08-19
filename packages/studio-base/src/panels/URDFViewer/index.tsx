// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IDropdownOption } from "@fluentui/react";
import produce from "immer";
import { isEmpty, set } from "lodash";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useResizeDetector } from "react-resize-detector";
import { makeStyles } from "tss-react/mui";

import { filterMap } from "@foxglove/den/collection";
import {
  CameraStore,
  CameraListener,
  CameraState,
  DEFAULT_CAMERA_STATE,
} from "@foxglove/regl-worldview";
import { SettingsTreeAction } from "@foxglove/studio";
import * as PanelAPI from "@foxglove/studio-base/PanelAPI";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import { useAssets } from "@foxglove/studio-base/context/AssetsContext";
import useCleanup from "@foxglove/studio-base/hooks/useCleanup";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelSettingsEditorContextProvider";
import { JointState } from "@foxglove/studio-base/types/Messages";
import { SaveConfig } from "@foxglove/studio-base/types/panels";
import { ROBOT_DESCRIPTION_PARAM } from "@foxglove/studio-base/util/globalConstants";

import { JointValueSliders } from "./JointValueSliders";
import OverlayControls from "./OverlayControls";
import { Renderer } from "./Renderer";
import helpContent from "./index.help.md";
import { buildSettingsTree } from "./settings";
import { Config } from "./types";
import useRobotDescriptionAsset from "./useRobotDescriptionAsset";

const DEFAULT_DISTANCE = 5;

type Props = {
  config: Config;
  saveConfig: SaveConfig<Config>;
};

const defaultConfig: Config = {
  jointStatesTopic: "/joint_states",
  opacity: 0.75,
};

const DATA_TYPES = Object.freeze([
  "sensor_msgs/JointState",
  "sensor_msgs/msg/JointState",
  "ros.sensor_msgs.JointState",
]);

const useStyles = makeStyles()({
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
});

function URDFViewer({ config, saveConfig }: Props) {
  const { classes } = useStyles();
  const { customJointValues, jointStatesTopic, opacity } = config;
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
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>();

  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();

  const model = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const asset = assets.find(({ type, uuid }) => uuid === selectedAssetId && type === "urdf");
    return asset?.model;
  }, [assets, selectedAssetId]);

  // Automatically select newly added URDF assets
  const prevAssets = useRef<typeof assets | undefined>();
  useEffect(() => {
    const prevAssetIds = new Set(prevAssets.current?.map(({ uuid }) => uuid));
    prevAssets.current = assets;
    for (const asset of assets) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!prevAssetIds.has(asset.uuid) && asset.type === "urdf") {
        setSelectedAssetId(asset.uuid);
        return;
      }
    }
  }, [assets]);

  const [renderer] = useState(() => new Renderer());

  useCleanup(() => {
    renderer.dispose();
  });

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

  const [cameraState, setCameraState] = useState(() => ({
    ...DEFAULT_CAMERA_STATE,
    distance: DEFAULT_DISTANCE,
  }));
  const [cameraStore] = useState(() => new CameraStore(setCameraState, cameraState));
  const cameraCentered =
    cameraState.targetOffset[0] === 0 &&
    cameraState.targetOffset[1] === 0 &&
    cameraState.targetOffset[2] === 0;

  useLayoutEffect(() => {
    renderer.setCameraState(cameraState);
    renderer.render();
  });

  const setCustomJointValues = useCallback(
    (values: typeof customJointValues) => {
      saveConfig({ customJointValues: values });
    },
    [saveConfig],
  );

  const { topics } = PanelAPI.useDataSourceInfo();

  const { robotDescriptionAsset, messageBar } = useRobotDescriptionAsset();

  const assetOptions: IDropdownOption[] = useMemo(() => {
    const options = filterMap(assets, (asset) =>
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      asset.type === "urdf" ? { key: asset.uuid, text: asset.name } : undefined,
    );
    if (robotDescriptionAsset != undefined) {
      options.unshift({ key: ROBOT_DESCRIPTION_PARAM, text: ROBOT_DESCRIPTION_PARAM });
    }
    return options;
  }, [assets, robotDescriptionAsset]);

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action !== "update") {
        return;
      }

      const { input, path, value } = action.payload;

      if (input === "boolean" && path[1] === "manualControl") {
        saveConfig({
          jointStatesTopic: value === true ? undefined : defaultConfig.jointStatesTopic,
        });
        return;
      }

      saveConfig(produce((draft) => set(draft, path.slice(1), value)));
    },
    [saveConfig],
  );

  const availableTopics = useMemo(
    () => topics.filter((topic) => DATA_TYPES.includes(topic.datatype)),
    [topics],
  );

  useEffect(() => {
    updatePanelSettingsTree({
      actionHandler,
      nodes: buildSettingsTree(config, availableTopics),
    });
  }, [actionHandler, availableTopics, config, updatePanelSettingsTree]);

  return (
    <div className={classes.root}>
      <PanelToolbar helpContent={helpContent} />
      <div className={classes.content}>
        {messageBar}
        {model == undefined ? (
          <EmptyState>Drag and drop a URDF file to visualize it.</EmptyState>
        ) : (
          <div className={classes.viewer}>
            <div className={classes.inner} ref={resizeRef}>
              <div className={classes.canvasWrapper}>
                <CameraListener cameraStore={cameraStore} shiftKeys={true}>
                  <canvas ref={(el) => setCanvas(el)} width={width} height={height} />
                </CameraListener>
              </div>
              <OverlayControls
                assetOptions={assetOptions}
                selectedAssetId={selectedAssetId}
                onSelectAsset={(_event, option) =>
                  option != undefined && setSelectedAssetId(option.key as string)
                }
                opacity={opacity}
                onChangeOpacity={(value) => saveConfig({ opacity: value })}
                cameraCentered={cameraCentered}
                onCenterCamera={() => {
                  const newState: CameraState = {
                    ...cameraState,
                    targetOffset: [0, 0, 0],
                    distance: DEFAULT_DISTANCE,
                  };
                  cameraStore.setCameraState(newState);
                  setCameraState(newState);
                }}
              />
            </div>
            {manualJointControl && (
              <JointValueSliders
                model={model}
                customJointValues={customJointValues}
                onChange={setCustomJointValues}
              />
            )}
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
