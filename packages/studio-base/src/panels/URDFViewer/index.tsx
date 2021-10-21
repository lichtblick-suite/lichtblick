// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { ComboBox, IDropdownOption, Stack, Toggle } from "@fluentui/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useResizeDetector } from "react-resize-detector";

import { filterMap } from "@foxglove/den/collection";
import {
  CameraStore,
  CameraListener,
  CameraState,
  DEFAULT_CAMERA_STATE,
} from "@foxglove/regl-worldview";
import * as PanelAPI from "@foxglove/studio-base/PanelAPI";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import Flex from "@foxglove/studio-base/components/Flex";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import { useAssets } from "@foxglove/studio-base/context/AssetsContext";
import useCleanup from "@foxglove/studio-base/hooks/useCleanup";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import { JointState } from "@foxglove/studio-base/types/Messages";
import { SaveConfig } from "@foxglove/studio-base/types/panels";
import { ROBOT_DESCRIPTION_PARAM } from "@foxglove/studio-base/util/globalConstants";

import { JointValueSliders } from "./JointValueSliders";
import OverlayControls from "./OverlayControls";
import { Renderer } from "./Renderer";
import helpContent from "./index.help.md";
import useRobotDescriptionAsset from "./useRobotDescriptionAsset";

export type EventTypes = {
  cameraMove: () => void;
};
type Config = {
  jointStatesTopic?: string;
  customJointValues?: Record<string, number>;
  opacity?: number;
};
export type Props = {
  config: Config;
  saveConfig: SaveConfig<Config>;
};

const DEFAULT_DISTANCE = 5;

const defaultConfig: Config = {
  jointStatesTopic: "/joint_states",
  opacity: 0.75,
};

function URDFViewer({ config, saveConfig }: Props) {
  const { customJointValues, jointStatesTopic, opacity } = config;
  const [canvas, setCanvas] = useState<HTMLCanvasElement | ReactNull>(ReactNull);

  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // and existing resize observation.
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

  const model = useMemo(() => {
    const asset = assets.find(({ type, uuid }) => uuid === selectedAssetId && type === "urdf");
    return asset?.model;
  }, [assets, selectedAssetId]);

  // Automatically select newly added URDF assets
  const prevAssets = useRef<typeof assets | undefined>();
  useEffect(() => {
    const prevAssetIds = new Set(prevAssets.current?.map(({ uuid }) => uuid));
    prevAssets.current = assets;
    for (const asset of assets) {
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

  const useCustomJointValues = jointStatesTopic == undefined;
  const jointValues = useMemo(() => {
    if (useCustomJointValues) {
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
  }, [customJointValues, latestJointStatesMessage, useCustomJointValues]);

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
  const topicOptions = useMemo(() => {
    const options = filterMap(topics, ({ name, datatype }) =>
      datatype === "sensor_msgs/JointState" || datatype === "sensor_msgs/msg/JointState"
        ? { key: name, text: name }
        : undefined,
    );
    // Include a custom option that may not be present (yet) in the list of topics
    if (
      jointStatesTopic != undefined &&
      jointStatesTopic !== "" &&
      !options.some(({ key }) => key === jointStatesTopic)
    ) {
      options.unshift({ key: jointStatesTopic, text: jointStatesTopic });
    }
    return options;
  }, [jointStatesTopic, topics]);

  const { robotDescriptionAsset, messageBar } = useRobotDescriptionAsset();

  const assetOptions: IDropdownOption[] = useMemo(() => {
    const options = filterMap(assets, (asset) =>
      asset.type === "urdf" ? { key: asset.uuid, text: asset.name } : undefined,
    );
    if (robotDescriptionAsset != undefined) {
      options.unshift({ key: ROBOT_DESCRIPTION_PARAM, text: ROBOT_DESCRIPTION_PARAM });
    }
    return options;
  }, [assets, robotDescriptionAsset]);

  return (
    <Flex col clip>
      <PanelToolbar helpContent={helpContent}>
        <Stack grow horizontal verticalAlign="baseline">
          <Toggle
            inlineLabel
            offText="Manual joint control"
            onText="Topic"
            checked={!useCustomJointValues}
            onChange={(_event, checked) =>
              saveConfig({
                jointStatesTopic: checked ?? false ? defaultConfig.jointStatesTopic : undefined,
              })
            }
          />
          {!useCustomJointValues && (
            <ComboBox
              allowFreeform
              options={topicOptions}
              selectedKey={jointStatesTopic}
              onChange={(_event, option, _index, value) => {
                if (option) {
                  saveConfig({ jointStatesTopic: option.key as string });
                } else if (value != undefined) {
                  saveConfig({ jointStatesTopic: value });
                }
              }}
            />
          )}
        </Stack>
      </PanelToolbar>
      <Stack verticalFill>
        {messageBar}
        {model == undefined ? (
          <EmptyState>Drag and drop a URDF file to visualize it.</EmptyState>
        ) : (
          <Flex row clip>
            <div ref={resizeRef} style={{ flex: "1 1 auto", position: "relative" }}>
              <div style={{ position: "absolute", inset: 0 }}>
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
            {useCustomJointValues && model && (
              <JointValueSliders
                model={model}
                customJointValues={customJointValues}
                onChange={setCustomJointValues}
              />
            )}
          </Flex>
        )}
      </Stack>
    </Flex>
  );
}

export default Panel(
  Object.assign(URDFViewer, {
    panelType: "URDFViewer",
    defaultConfig,
  }),
);
