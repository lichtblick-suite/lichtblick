// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Theme } from "@mui/material";
import { makeStyles } from "@mui/styles";
import cx from "classnames";
import produce from "immer";
import { difference, set, union } from "lodash";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useUpdateEffect } from "react-use";

import { useDataSourceInfo } from "@foxglove/studio-base/PanelAPI";
import { useMessagePipeline } from "@foxglove/studio-base/components/MessagePipeline";
import Panel from "@foxglove/studio-base/components/Panel";
import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import { SettingsTreeAction } from "@foxglove/studio-base/components/SettingsTreeEditor/types";
import Stack from "@foxglove/studio-base/components/Stack";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelSettingsEditorContextProvider";
import inScreenshotTests from "@foxglove/studio-base/stories/inScreenshotTests";
import { CameraInfo } from "@foxglove/studio-base/types/Messages";
import { mightActuallyBePartial } from "@foxglove/studio-base/util/mightActuallyBePartial";
import { getTopicsByTopicName } from "@foxglove/studio-base/util/selectors";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

import { ImageCanvas, ImageEmptyState, Toolbar, TopicDropdown, TopicTimestamp } from "./components";
import { useCameraInfo, ANNOTATION_DATATYPES, useImagePanelMessages } from "./hooks";
import helpContent from "./index.help.md";
import { NORMALIZABLE_IMAGE_DATATYPES } from "./lib/normalizeMessage";
import { getRelatedMarkerTopics, getMarkerOptions } from "./lib/util";
import { buildSettingsTree } from "./settings";
import type { Config, SaveImagePanelConfig, PixelData } from "./types";

type Props = {
  config: Config;
  saveConfig: SaveImagePanelConfig;
};

const useStyles = makeStyles((theme: Theme) => ({
  controls: {
    display: "flex",
    flexWrap: "wrap",
    flex: "1 1 auto",
    alignItems: "center",
    overflow: "hidden",
    gap: theme.spacing(0.5),
  },
  bottomBar: {
    transition: "opacity 0.1s ease-in-out",
    display: "flex",
    flex: "0 0 auto",
    flexDirection: "row",
    backgroundColor: "transparent",
    textAlign: "right",
    position: "absolute",
    right: 4,
    paddingRight: 5,
    bottom: 8,
    zIndex: 100,
    opacity: "0",

    "&.inScreenshotTests": {
      opacity: 1,
    },
    ".mosaic-window:hover &": {
      opacity: "1",
    },
  },
  dropdown: {
    padding: "4px 8px !important",
  },
  dropdownTitle: {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    flexShrink: 1,
    display: "flex",
    alignItems: "center",
  },
  dropdownItem: {
    position: "relative",
  },
  toggleButton: {
    display: "flex",
    alignItems: "center",
  },
  emptyStateContainer: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
}));

const BottomBar = ({ children }: { children?: React.ReactNode }) => {
  const classes = useStyles();
  return (
    <div
      className={cx(classes.bottomBar, {
        inScreenshotTests: inScreenshotTests(),
      })}
    >
      {children}
    </div>
  );
};

function ImageView(props: Props) {
  const classes = useStyles();
  const { config, saveConfig } = props;
  const { cameraTopic, enabledMarkerTopics, transformMarkers } = config;
  const { topics } = useDataSourceInfo();
  const cameraTopicFullObject = useMemo(
    () => getTopicsByTopicName(topics)[cameraTopic],
    [cameraTopic, topics],
  );
  const [activePixelData, setActivePixelData] = useState<PixelData | undefined>();
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();
  const { id: panelId } = usePanelContext();

  const allImageTopics = useMemo(() => {
    return topics.filter(({ datatype }) => NORMALIZABLE_IMAGE_DATATYPES.includes(datatype));
  }, [topics]);

  // If no cameraTopic is selected, automatically select the first available image topic
  useEffect(() => {
    const maybeCameraTopic = mightActuallyBePartial(config).cameraTopic;
    if (maybeCameraTopic == undefined || maybeCameraTopic === "") {
      if (allImageTopics[0] && allImageTopics[0].name !== "") {
        saveConfig({ cameraTopic: allImageTopics[0].name });
      }
    }
  }, [allImageTopics, config, saveConfig]);

  const onChangeCameraTopic = useCallback(
    (newCameraTopic: string) => {
      const newAvailableMarkerTopics = getMarkerOptions(
        newCameraTopic,
        topics,
        ANNOTATION_DATATYPES,
      );

      const newEnabledMarkerTopics = getRelatedMarkerTopics(
        enabledMarkerTopics,
        newAvailableMarkerTopics,
      );

      saveConfig({
        cameraTopic: newCameraTopic,
        enabledMarkerTopics: newEnabledMarkerTopics,
      });
    },
    [enabledMarkerTopics, saveConfig, topics],
  );

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action !== "update") {
        return;
      }

      const { path, value } = action.payload;
      saveConfig(
        produce(config, (draft) => {
          if (path[0] === "markers") {
            const markerTopic = path[1] ?? "unknown";
            const newValue =
              value === true
                ? union(draft.enabledMarkerTopics, [markerTopic])
                : difference(draft.enabledMarkerTopics, [markerTopic]);
            draft.enabledMarkerTopics = newValue;
          } else {
            set(draft, path.slice(1), value);
          }
        }),
      );

      if (path[1] === "cameraTopic" && typeof value === "string") {
        onChangeCameraTopic(value);
      }
    },
    [config, onChangeCameraTopic, saveConfig],
  );

  const allAnnotationTopics = useMemo(() => {
    return topics
      .filter((topic) => (ANNOTATION_DATATYPES as readonly string[]).includes(topic.datatype))
      .map((topic) => topic.name);
  }, [topics]);

  useEffect(() => {
    updatePanelSettingsTree(panelId, {
      actionHandler,
      roots: buildSettingsTree(config, allImageTopics, allAnnotationTopics, enabledMarkerTopics),
    });
  }, [
    actionHandler,
    allAnnotationTopics,
    allImageTopics,
    config,
    enabledMarkerTopics,
    panelId,
    updatePanelSettingsTree,
  ]);

  const cameraInfo = useCameraInfo(cameraTopic);

  const shouldSynchronize = config.synchronize && enabledMarkerTopics.length > 0;

  const { image, annotations } = useImagePanelMessages({
    imageTopic: cameraTopic,
    annotationTopics: enabledMarkerTopics,
    synchronize: shouldSynchronize,
  });

  const lastImageMessageRef = useRef(image);

  useEffect(() => {
    if (image) {
      lastImageMessageRef.current = image;
    }
  }, [image]);

  // Keep the last image message, if it exists, to render on the ImageCanvas.
  // Improve perf by hiding the ImageCanvas while seeking, instead of unmounting and remounting it.
  const imageMessageToRender = image ?? lastImageMessageRef.current;

  // Clear our cached last image when the camera topic changes since it came from the old topic.
  useUpdateEffect(() => {
    lastImageMessageRef.current = undefined;
  }, [cameraTopic]);

  const pauseFrame = useMessagePipeline(
    useCallback((messagePipeline) => messagePipeline.pauseFrame, []),
  );
  const onStartRenderImage = useCallback(() => {
    const resumeFrame = pauseFrame("ImageView");
    const onFinishRenderImage = () => {
      resumeFrame();
    };
    return onFinishRenderImage;
  }, [pauseFrame]);

  const rawMarkerData = useMemo(() => {
    return {
      markers: annotations ?? [],
      transformMarkers,
      // Convert to plain object before sending to web worker
      cameraInfo:
        (cameraInfo as { toJSON?: () => CameraInfo } | undefined)?.toJSON?.() ?? cameraInfo,
    };
  }, [annotations, cameraInfo, transformMarkers]);

  const renderBottomBar = () => {
    const topicTimestamp = (
      <TopicTimestamp
        style={{ padding: "8px 8px 0px 0px" }}
        text={image ? formatTimeRaw(image.stamp) : ""}
      />
    );

    return <BottomBar>{topicTimestamp}</BottomBar>;
  };

  const imageTopicDropdown = useMemo(() => {
    const items = allImageTopics.map((topic) => {
      return {
        name: topic.name,
        selected: topic.name === cameraTopic,
      };
    });

    function onChange(newTopics: string[]) {
      const newTopic = newTopics[0];
      if (newTopic) {
        onChangeCameraTopic(newTopic);
      }
    }

    const title = cameraTopic
      ? cameraTopic
      : items.length === 0
      ? "No camera topics"
      : "Select a camera topic";

    return <TopicDropdown multiple={false} title={title} items={items} onChange={onChange} />;
  }, [cameraTopic, allImageTopics, onChangeCameraTopic]);

  const showEmptyState = !imageMessageToRender;

  return (
    <Stack flex="auto" overflow="hidden" position="relative">
      <PanelToolbar helpContent={helpContent}>
        <div className={classes.controls}>{imageTopicDropdown}</div>
      </PanelToolbar>
      <Stack fullWidth fullHeight>
        {/* Always render the ImageCanvas because it's expensive to unmount and start up. */}
        {imageMessageToRender && (
          <ImageCanvas
            topic={cameraTopicFullObject}
            image={imageMessageToRender}
            rawMarkerData={rawMarkerData}
            config={config}
            saveConfig={saveConfig}
            onStartRenderImage={onStartRenderImage}
            setActivePixelData={setActivePixelData}
          />
        )}
        {/* If rendered, EmptyState will hide the always-present ImageCanvas */}
        {showEmptyState && (
          <div className={classes.emptyStateContainer}>
            <ImageEmptyState
              cameraTopic={cameraTopic}
              markerTopics={enabledMarkerTopics}
              shouldSynchronize={shouldSynchronize}
            />
          </div>
        )}
        {!showEmptyState && renderBottomBar()}
      </Stack>
      <Toolbar pixelData={activePixelData} />
    </Stack>
  );
}

const defaultConfig: Config = {
  cameraTopic: "",
  enabledMarkerTopics: [],
  mode: "fit",
  pan: { x: 0, y: 0 },
  rotation: 0,
  synchronize: false,
  transformMarkers: false,
  zoom: 1,
};

export default Panel(
  Object.assign(ImageView, {
    panelType: "ImageViewPanel",
    defaultConfig,
  }),
);
