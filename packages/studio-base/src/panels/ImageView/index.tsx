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

import { useTheme } from "@fluentui/react";
import WavesIcon from "@mdi/svg/svg/waves.svg";
import { Stack, Theme } from "@mui/material";
import { makeStyles } from "@mui/styles";
import cx from "classnames";
import produce from "immer";
import { set } from "lodash";
import { useEffect, useState, useMemo, useCallback, useRef, useContext } from "react";

import { useDataSourceInfo } from "@foxglove/studio-base/PanelAPI";
import Icon from "@foxglove/studio-base/components/Icon";
import { useMessagePipeline } from "@foxglove/studio-base/components/MessagePipeline";
import Panel from "@foxglove/studio-base/components/Panel";
import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import {
  SettingsTreeAction,
  SettingsTreeNode,
} from "@foxglove/studio-base/components/SettingsTreeEditor/types";
import { PanelSettingsEditorContext } from "@foxglove/studio-base/context/PanelSettingsEditorContext";
import inScreenshotTests from "@foxglove/studio-base/stories/inScreenshotTests";
import { mightActuallyBePartial } from "@foxglove/studio-base/util/mightActuallyBePartial";
import { getTopicsByTopicName } from "@foxglove/studio-base/util/selectors";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

import { ImageCanvas, ImageEmptyState, Toolbar, TopicDropdown, TopicTimestamp } from "./components";
import { useCameraInfo, ANNOTATION_DATATYPES, useImagePanelMessages } from "./hooks";
import helpContent from "./index.help.md";
import { NORMALIZABLE_IMAGE_DATATYPES } from "./lib/normalizeMessage";
import { getRelatedMarkerTopics, getMarkerOptions } from "./lib/util";
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

function buildSettingsTree(config: Config): SettingsTreeNode {
  return {
    label: "General",
    fields: {
      transformMarkers: {
        input: "boolean",
        label: "Synchronize Markers",
        value: config.transformMarkers,
      },
      smooth: {
        input: "boolean",
        label: "Bilinear Smoothing",
        value: config.smooth ?? false,
      },
      flipHorizontal: {
        input: "boolean",
        label: "Flip Horizontal",
        value: config.flipHorizontal ?? false,
      },
      flipVertical: {
        input: "boolean",
        label: "Flip Vertical",
        value: config.flipVertical ?? false,
      },
      rotation: {
        input: "select",
        label: "Rotation",
        value: config.rotation ?? 0,
        options: [
          { label: "0°", value: 0 },
          { label: "90°", value: 90 },
          { label: "180°", value: 180 },
          { label: "270°", value: 270 },
        ],
      },
      minValue: {
        input: "number",
        label: "Minimum Value (depth images)",
        placeholder: "0",
        value: config.minValue,
      },
      maxValue: {
        input: "number",
        label: "Maximum Value (depth images)",
        placeholder: "10000",
        value: config.maxValue,
      },
    },
  };
}

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
  const theme = useTheme();
  const { topics } = useDataSourceInfo();
  const cameraTopicFullObject = useMemo(
    () => getTopicsByTopicName(topics)[cameraTopic],
    [cameraTopic, topics],
  );
  const [activePixelData, setActivePixelData] = useState<PixelData | undefined>();
  const { updatePanelSettingsTree } = useContext(PanelSettingsEditorContext);
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

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      saveConfig(
        produce(config, (draft) => {
          set(draft, action.payload.path, action.payload.value);
        }),
      );
    },
    [config, saveConfig],
  );

  useEffect(() => {
    updatePanelSettingsTree(panelId, {
      actionHandler,
      settings: buildSettingsTree(config),
    });
  }, [actionHandler, config, panelId, updatePanelSettingsTree]);

  const relatedAnnotationTopics = useMemo(
    () => getMarkerOptions(cameraTopic, topics, ANNOTATION_DATATYPES),
    [cameraTopic, topics],
  );

  const allAnnotationTopics = useMemo(() => {
    return topics
      .filter((topic) => (ANNOTATION_DATATYPES as readonly string[]).includes(topic.datatype))
      .map((topic) => topic.name);
  }, [topics]);

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

  const cameraInfo = useCameraInfo(cameraTopic);

  const shouldSynchronize = config.synchronize && enabledMarkerTopics.length > 0;

  const { image, annotations } = useImagePanelMessages({
    imageTopic: cameraTopic,
    annotationTopics: enabledMarkerTopics,
    synchronize: shouldSynchronize,
  });

  const rootRef = useRef<HTMLDivElement>(ReactNull);

  const annotationDropdown = useMemo(() => {
    const allSet = new Set(allAnnotationTopics);
    const enabledAnnotationTopics = new Set(enabledMarkerTopics);

    const dropdownTopics = [];

    // Related topics come first since those are more likely to be what the user wants to show
    for (const topic of relatedAnnotationTopics) {
      dropdownTopics.push({
        name: topic,
        selected: enabledAnnotationTopics.has(topic),
      });

      allSet.delete(topic);
    }

    // Then add all the other available annotation topics
    for (const topic of allSet) {
      dropdownTopics.push({
        name: topic,
        selected: enabledAnnotationTopics.has(topic),
      });
    }

    function onChange(activeTopics: string[]) {
      saveConfig({
        enabledMarkerTopics: activeTopics,
      });
    }

    return (
      <TopicDropdown
        anchorEl={rootRef.current}
        multiple={true}
        title="Annotations"
        items={dropdownTopics}
        onChange={onChange}
      />
    );
  }, [allAnnotationTopics, enabledMarkerTopics, relatedAnnotationTopics, saveConfig]);

  const lastImageMessageRef = useRef(image);
  if (image) {
    lastImageMessageRef.current = image;
  }
  // Keep the last image message, if it exists, to render on the ImageCanvas.
  // Improve perf by hiding the ImageCanvas while seeking, instead of unmounting and remounting it.
  const imageMessageToRender = image ?? lastImageMessageRef.current;

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
      cameraInfo,
    };
  }, [annotations, cameraInfo, transformMarkers]);

  const renderBottomBar = () => {
    const topicTimestamp = (
      <TopicTimestamp
        style={{ padding: "8px 8px 0px 0px" }}
        text={image ? formatTimeRaw(image.stamp) : ""}
      />
    );

    return (
      <BottomBar>
        {topicTimestamp}
        <Icon
          onClick={() => saveConfig({ transformMarkers: !transformMarkers })}
          tooltip={
            transformMarkers
              ? "Markers are being transformed by Foxglove Studio based on the camera model. Click to turn it off."
              : `Markers can be transformed by Foxglove Studio based on the camera model. Click to turn it on.`
          }
          fade
          size="medium"
        >
          <WavesIcon
            style={{
              color: transformMarkers
                ? theme.semanticColors.warningBackground
                : theme.semanticColors.disabledText,
            }}
          />
        </Icon>
      </BottomBar>
    );
  };

  const showEmptyState = !image;

  return (
    <Stack flex="auto" overflow="hidden" position="relative">
      {/*
      HACK:
      When the floating panel toolbar disappears, it also removes the anchor elements for
      the dropdown menus. When the anchor element is removed, the dropdown menu re-positions to a
      different part of the screen. To prevent the re-positioning of the open menu, we use an empty
      div as the anchor for our annotation dropdown. This keeps the annotation dropdown stable even
      when the toolbar goes away.

      The image topic dropdown does not need the anchor because it closes after an image is selected.
      The annotation dropdown allows multiple selection and remains open.
      */}
      <div ref={rootRef}></div>
      <PanelToolbar floating={cameraTopic !== ""} helpContent={helpContent}>
        <div className={classes.controls}>
          {imageTopicDropdown}
          {annotationDropdown}
        </div>
      </PanelToolbar>
      <Stack width="100%" height="100%">
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
