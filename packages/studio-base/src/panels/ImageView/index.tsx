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

import { makeStyles, useTheme } from "@fluentui/react";
import CheckboxBlankOutlineIcon from "@mdi/svg/svg/checkbox-blank-outline.svg";
import CheckboxMarkedIcon from "@mdi/svg/svg/checkbox-marked.svg";
import CloseIcon from "@mdi/svg/svg/close.svg";
import MenuDownIcon from "@mdi/svg/svg/menu-down.svg";
import WavesIcon from "@mdi/svg/svg/waves.svg";
import { Stack } from "@mui/material";
import cx from "classnames";
import { last, uniq } from "lodash";
import { useEffect, useState } from "react";

import { filterMap } from "@foxglove/den/collection";
import { useShallowMemo } from "@foxglove/hooks";
import * as PanelAPI from "@foxglove/studio-base/PanelAPI";
import Autocomplete from "@foxglove/studio-base/components/Autocomplete";
import Dropdown from "@foxglove/studio-base/components/Dropdown";
import DropdownItem from "@foxglove/studio-base/components/Dropdown/DropdownItem";
import Icon from "@foxglove/studio-base/components/Icon";
import { LegacyButton } from "@foxglove/studio-base/components/LegacyStyledComponents";
import { Item, SubMenu } from "@foxglove/studio-base/components/Menu";
import { useMessagePipeline } from "@foxglove/studio-base/components/MessagePipeline";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import useDeepMemo from "@foxglove/studio-base/hooks/useDeepMemo";
import { Toolbar } from "@foxglove/studio-base/panels/ImageView/Toolbar";
import { IMAGE_DATATYPES } from "@foxglove/studio-base/panels/ImageView/renderImage";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import inScreenshotTests from "@foxglove/studio-base/stories/inScreenshotTests";
import { CameraInfo, StampedMessage } from "@foxglove/studio-base/types/Messages";
import { PanelConfigSchema, SaveConfig } from "@foxglove/studio-base/types/panels";
import naturalSort from "@foxglove/studio-base/util/naturalSort";
import { getTopicsByTopicName } from "@foxglove/studio-base/util/selectors";
import { getSynchronizingReducers } from "@foxglove/studio-base/util/synchronizeMessages";
import { formatTimeRaw, getTimestampForMessage } from "@foxglove/studio-base/util/time";
import toggle from "@foxglove/studio-base/util/toggle";

import ImageCanvas from "./ImageCanvas";
import ImageEmptyState from "./ImageEmptyState";
import helpContent from "./index.help.md";
import {
  getCameraInfoTopic,
  getCameraNamespace,
  getRelatedMarkerTopics,
  getMarkerOptions,
  groupTopics,
  PixelData,
  ZoomMode,
} from "./util";

const { useMemo, useCallback } = React;

type DefaultConfig = {
  cameraTopic: string;
  enabledMarkerTopics: string[];
  customMarkerTopicOptions?: string[];
  synchronize: boolean;
};

export type Config = DefaultConfig & {
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  maxValue?: number;
  minValue?: number;
  mode?: ZoomMode;
  pan?: { x: number; y: number };
  rotation?: number;
  saveStoryConfig?: () => void;
  smooth?: boolean;
  transformMarkers: boolean;
  zoom?: number;
  zoomPercentage?: number;
};

export type SaveImagePanelConfig = SaveConfig<Config>;

type Props = {
  config: Config;
  saveConfig: SaveImagePanelConfig;
};

const useStyles = makeStyles(() => ({
  controls: {
    display: "flex",
    flexWrap: "wrap",
    flex: "1 1 auto",
    alignItems: "center",
    overflow: "hidden",

    button: {
      margin: "1px 4px 1px 0",
    },
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
  topicTimestamp: {
    padding: "0px 15px 0px 0px",
    fontSize: 10,
    fontStyle: "italic",
  },
  emptyStateContainer: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
}));

const TopicTimestamp = ({
  text,
  style: styleObj,
}: {
  text: string;
  style?: {
    [key: string]: string;
  };
}) => {
  const classes = useStyles();
  return text === "" ? (
    ReactNull
  ) : (
    <span className={classes.topicTimestamp} style={styleObj}>
      {text}
    </span>
  );
};

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

const ToggleComponent = ({
  text,
  disabled = false,
  dataTest,
}: {
  text: string;
  disabled?: boolean;
  dataTest?: string;
}) => {
  const classes = useStyles();
  return (
    <LegacyButton
      style={{ maxWidth: "100%", padding: "4px 8px" }}
      className={cx(classes.toggleButton, { disabled })}
      data-test={dataTest}
    >
      <span className={classes.dropdownTitle}>{text}</span>
      <Icon style={{ marginLeft: 4 }}>
        <MenuDownIcon style={{ width: 14, height: 14, opacity: 0.5 }} />
      </Icon>
    </LegacyButton>
  );
};

const canTransformMarkersByTopic = (topic: string) => !topic.includes("rect");

function useOptionallySynchronizedMessages(
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  shouldSynchronize: boolean,
  topics: readonly PanelAPI.RequestedTopic[],
) {
  const memoizedTopics = useDeepMemo(topics);
  const reducers = useMemo(
    () =>
      shouldSynchronize
        ? getSynchronizingReducers(
            memoizedTopics.map((request) =>
              typeof request === "string" ? request : request.topic,
            ),
          )
        : {
            restore: (previousValue) => ({
              messagesByTopic: previousValue ? previousValue.messagesByTopic : {},
              synchronizedMessages: undefined,
            }),
            addMessage: ({ messagesByTopic }, newMessage) => ({
              messagesByTopic: { ...messagesByTopic, [newMessage.topic]: [newMessage] },
              synchronizedMessages: undefined,
            }),
          },
    [shouldSynchronize, memoizedTopics],
  );
  return PanelAPI.useMessageReducer({
    topics,
    ...reducers,
  });
}

const AddTopic = ({
  onSelectTopic,
  topics,
}: {
  onSelectTopic: (arg0: string) => void;
  topics: string[];
}) => {
  return (
    <div style={{ padding: "8px 12px", height: "31px" }}>
      <Autocomplete
        placeholder="Add topic"
        items={topics}
        onSelect={onSelectTopic}
        getItemValue={(s) => String(s)}
        getItemText={(s) => String(s)}
      />
    </div>
  );
};

const NO_CUSTOM_OPTIONS: string[] = [];

function ImageView(props: Props) {
  const classes = useStyles();
  const { config, saveConfig } = props;
  const {
    cameraTopic,
    enabledMarkerTopics,
    transformMarkers,
    customMarkerTopicOptions = NO_CUSTOM_OPTIONS,
  } = config;
  const theme = useTheme();
  const { topics } = PanelAPI.useDataSourceInfo();
  const cameraTopicFullObject = useMemo(
    () => getTopicsByTopicName(topics)[cameraTopic],
    [cameraTopic, topics],
  );
  const [activePixelData, setActivePixelData] = useState<PixelData | undefined>();

  // Namespaces represent marker topics based on the camera topic prefix (e.g. "/camera_front_medium")
  const { allCameraNamespaces, imageTopicsByNamespace, allImageTopics } = useMemo(() => {
    const imageTopics = (topics ?? []).filter(({ datatype }) => IMAGE_DATATYPES.includes(datatype));
    const topicsByNamespace = groupTopics(imageTopics);
    return {
      allImageTopics: imageTopics,
      imageTopicsByNamespace: topicsByNamespace,
      allCameraNamespaces: [...topicsByNamespace.keys()],
    };
  }, [topics]);

  // If no cameraTopic is selected, automatically select the first available image topic
  useEffect(() => {
    if (cameraTopic == undefined || cameraTopic === "") {
      if (allImageTopics[0] && allImageTopics[0].name !== "") {
        saveConfig({ cameraTopic: allImageTopics[0].name });
      }
    }
  }, [allImageTopics, cameraTopic, saveConfig]);

  const imageMarkerDatatypes = useMemo(
    () => [
      // Single marker
      "visualization_msgs/ImageMarker",
      "visualization_msgs/msg/ImageMarker",
      "ros.visualization_msgs.ImageMarker",
      // Marker arrays
      "foxglove_msgs/ImageMarkerArray",
      "foxglove_msgs/msg/ImageMarkerArray",
      "studio_msgs/ImageMarkerArray",
      "studio_msgs/msg/ImageMarkerArray",
      "visualization_msgs/ImageMarkerArray",
      "visualization_msgs/msg/ImageMarkerArray",
      "ros.visualization_msgs.ImageMarkerArray",
      // backwards compat with webviz
      "webviz_msgs/ImageMarkerArray",
    ],
    [],
  );
  const defaultAvailableMarkerTopics = useMemo(
    () => getMarkerOptions(cameraTopic, topics, allCameraNamespaces, imageMarkerDatatypes),
    [cameraTopic, topics, allCameraNamespaces, imageMarkerDatatypes],
  );
  const availableAndEnabledMarkerTopics = useShallowMemo(
    uniq([
      ...defaultAvailableMarkerTopics,
      ...customMarkerTopicOptions,
      ...enabledMarkerTopics,
    ]).sort(),
  );
  const onToggleMarkerName = useCallback(
    (markerTopic: string) => {
      saveConfig({ enabledMarkerTopics: toggle(enabledMarkerTopics, markerTopic) });
    },
    [saveConfig, enabledMarkerTopics],
  );

  const onChangeCameraTopic = useCallback(
    (newCameraTopic: string) => {
      const newAvailableMarkerTopics = getMarkerOptions(
        newCameraTopic,
        topics,
        allCameraNamespaces,
        imageMarkerDatatypes,
      );

      const newEnabledMarkerTopics = getRelatedMarkerTopics(
        enabledMarkerTopics,
        newAvailableMarkerTopics,
      );

      saveConfig({
        cameraTopic: newCameraTopic,
        transformMarkers: canTransformMarkersByTopic(newCameraTopic),
        enabledMarkerTopics: newEnabledMarkerTopics,
      });
    },
    [topics, allCameraNamespaces, imageMarkerDatatypes, enabledMarkerTopics, saveConfig],
  );
  const imageTopicDropdown = useMemo(() => {
    const cameraNamespace = getCameraNamespace(cameraTopic);

    if (imageTopicsByNamespace.size === 0) {
      return (
        <Dropdown
          btnClassname={classes.dropdown}
          toggleComponent={
            <ToggleComponent
              dataTest={"topics-dropdown"}
              text={cameraTopic ? cameraTopic : "No image topics"}
              disabled
            />
          }
        />
      );
    }

    const items = [...imageTopicsByNamespace.keys()].sort().map((namespace) => {
      const imageTopics = imageTopicsByNamespace.get(namespace);
      if (!imageTopics) {
        return ReactNull;
      }

      // If a namespace only contains itself as an entry, just render that item instead of a submenu.
      if (imageTopics.length === 1 && imageTopics[0]?.name === namespace) {
        return (
          <DropdownItem key={namespace} value={namespace}>
            {namespace}
          </DropdownItem>
        );
      }

      imageTopics.sort(naturalSort("name"));

      return (
        <SubMenu
          direction="right"
          key={namespace}
          text={namespace}
          checked={namespace === cameraNamespace}
          dataTest={namespace.substr(1)}
        >
          {imageTopics.map((topic) => {
            return (
              <DropdownItem key={topic.name} value={topic.name}>
                <Item
                  checked={topic.name === cameraTopic}
                  onClick={() => onChangeCameraTopic(topic.name)}
                >
                  {topic.name}
                </Item>
              </DropdownItem>
            );
          })}
        </SubMenu>
      );
    });
    return (
      <Dropdown
        toggleComponent={
          <ToggleComponent
            dataTest={"topics-dropdown"}
            text={cameraTopic.length > 0 ? cameraTopic : "Select a topic"}
          />
        }
        value={cameraTopic}
        onChange={(value) => onChangeCameraTopic(value)}
      >
        {items}
      </Dropdown>
    );
  }, [cameraTopic, classes.dropdown, imageTopicsByNamespace, onChangeCameraTopic]);

  const cameraInfoTopic = getCameraInfoTopic(cameraTopic);
  const cameraInfo = PanelAPI.useMessageReducer<CameraInfo | undefined>({
    topics: cameraInfoTopic != undefined ? [cameraInfoTopic] : [],
    restore: useCallback((value) => value, []),
    addMessage: useCallback(
      (_value: CameraInfo | undefined, { message }: MessageEvent<unknown>) => message as CameraInfo,
      [],
    ),
  });

  const shouldSynchronize = config.synchronize && enabledMarkerTopics.length > 0;
  const imageAndMarkerTopics = useShallowMemo([{ topic: cameraTopic }, ...enabledMarkerTopics]);
  const { messagesByTopic, synchronizedMessages } = useOptionallySynchronizedMessages(
    shouldSynchronize,
    imageAndMarkerTopics,
  );

  const markersToRender: MessageEvent<unknown>[] = useMemo(
    () =>
      shouldSynchronize
        ? synchronizedMessages
          ? filterMap(enabledMarkerTopics, (topic) => synchronizedMessages[topic])
          : []
        : filterMap(enabledMarkerTopics, (topic) => last(messagesByTopic[topic])),
    [enabledMarkerTopics, messagesByTopic, shouldSynchronize, synchronizedMessages],
  );

  // Timestamps are displayed for informational purposes in the markers menu
  const renderedMarkerTimestamps = useMemo(() => {
    const stamps: Record<string, string> = {};
    for (const { topic, message } of markersToRender) {
      // In some cases, a user may have subscribed to a topic that does not include a header stamp.
      const stamp = getTimestampForMessage(message);
      stamps[topic] = stamp != undefined ? formatTimeRaw(stamp) : "[ not available ]";
    }
    return stamps;
  }, [markersToRender]);

  const addTopicsMenu = useMemo(
    () => (
      <AddTopic
        topics={topics
          .map(({ name }) => name)
          .filter((topic) => !availableAndEnabledMarkerTopics.includes(topic))}
        onSelectTopic={(topic) =>
          saveConfig({
            enabledMarkerTopics: [...enabledMarkerTopics, topic],
            customMarkerTopicOptions: [...customMarkerTopicOptions, topic],
          })
        }
      />
    ),
    [
      topics,
      availableAndEnabledMarkerTopics,
      saveConfig,
      enabledMarkerTopics,
      customMarkerTopicOptions,
    ],
  );

  const markerDropdown = useMemo(() => {
    return (
      <Dropdown
        dataTest={"markers-dropdown"}
        closeOnChange={false}
        onChange={onToggleMarkerName}
        value={enabledMarkerTopics}
        text={availableAndEnabledMarkerTopics.length > 0 ? "Markers" : "No markers"}
        btnClassname={classes.dropdown}
      >
        {availableAndEnabledMarkerTopics.map((topic) => (
          <Item
            {...{ value: topic }}
            icon={
              enabledMarkerTopics.includes(topic) ? (
                <CheckboxMarkedIcon />
              ) : (
                <CheckboxBlankOutlineIcon />
              )
            }
            key={topic}
            className={classes.dropdownItem}
          >
            <span style={{ display: "inline-block", marginRight: "15px" }}>{topic}</span>
            <TopicTimestamp text={renderedMarkerTimestamps[topic] ?? ""} />
            {customMarkerTopicOptions.includes(topic) && (
              <Icon
                style={{ position: "absolute", right: "10px" }}
                onClick={() =>
                  saveConfig({
                    enabledMarkerTopics: enabledMarkerTopics.filter(
                      (topicOption) => topicOption !== topic,
                    ),
                    customMarkerTopicOptions: customMarkerTopicOptions.filter(
                      (topicOption) => topicOption !== topic,
                    ),
                  })
                }
              >
                <CloseIcon />
              </Icon>
            )}
          </Item>
        ))}
        {addTopicsMenu}
      </Dropdown>
    );
  }, [
    addTopicsMenu,
    availableAndEnabledMarkerTopics,
    classes.dropdown,
    classes.dropdownItem,
    customMarkerTopicOptions,
    enabledMarkerTopics,
    onToggleMarkerName,
    renderedMarkerTimestamps,
    saveConfig,
  ]);

  const imageMessage = messagesByTopic[cameraTopic]?.[0];
  const lastImageMessageRef = React.useRef(imageMessage);
  if (imageMessage) {
    lastImageMessageRef.current = imageMessage;
  }
  // Keep the last image message, if it exists, to render on the ImageCanvas.
  // Improve perf by hiding the ImageCanvas while seeking, instead of unmounting and remounting it.
  const imageMessageToRender = imageMessage ?? lastImageMessageRef.current;

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
      markers: markersToRender,
      transformMarkers,
      cameraInfo: markersToRender.length > 0 ? cameraInfo : undefined,
    };
  }, [cameraInfo, markersToRender, transformMarkers]);

  const toolbar = useMemo(() => {
    return (
      <PanelToolbar floating={cameraTopic !== ""} helpContent={helpContent}>
        <div className={classes.controls}>
          {imageTopicDropdown}
          {markerDropdown}
        </div>
      </PanelToolbar>
    );
  }, [cameraTopic, classes.controls, imageTopicDropdown, markerDropdown]);

  const renderBottomBar = () => {
    const canTransformMarkers = canTransformMarkersByTopic(cameraTopic);

    const topicTimestamp = (
      <TopicTimestamp
        style={{ padding: "8px 8px 0px 0px" }}
        text={
          imageMessage ? formatTimeRaw((imageMessage.message as StampedMessage).header.stamp) : ""
        }
      />
    );

    if (!canTransformMarkers) {
      return <BottomBar>{topicTimestamp}</BottomBar>;
    }

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

  const showEmptyState = !imageMessage || (shouldSynchronize && !synchronizedMessages);

  return (
    <Stack flex="auto" overflow="hidden" position="relative">
      {toolbar}
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
              messagesByTopic={messagesByTopic}
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
  customMarkerTopicOptions: [],
  enabledMarkerTopics: [],
  mode: "fit",
  pan: { x: 0, y: 0 },
  rotation: 0,
  synchronize: false,
  transformMarkers: false,
  zoom: 1,
};

const configSchema: PanelConfigSchema<Config> = [
  { key: "synchronize", type: "toggle", title: "Synchronize images and markers" },
  {
    key: "smooth",
    type: "toggle",
    title: "Bilinear smoothing",
  },
  {
    key: "flipHorizontal",
    type: "toggle",
    title: "Flip horizontally",
  },
  {
    key: "flipVertical",
    type: "toggle",
    title: "Flip vertically",
  },
  {
    key: "rotation",
    type: "dropdown",
    title: "Rotation",
    options: [
      { value: 0, text: "0°" },
      { value: 90, text: "90°" },
      { value: 180, text: "180°" },
      { value: 270, text: "270°" },
    ],
  },
  {
    key: "minValue",
    type: "number",
    title: "Minimum value (depth images)",
    placeholder: "0",
    allowEmpty: true,
  },
  {
    key: "maxValue",
    type: "number",
    title: "Maximum value (depth images)",
    placeholder: "10000",
    allowEmpty: true,
  },
];

export default Panel(
  Object.assign(ImageView, {
    panelType: "ImageViewPanel",
    defaultConfig,
    configSchema,
  }),
);
