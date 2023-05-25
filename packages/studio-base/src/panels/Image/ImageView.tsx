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

import { Typography } from "@mui/material";
import { produce } from "immer";
import { difference, keyBy, set, union } from "lodash";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import ReactDOM from "react-dom";
import { DeepPartial } from "ts-essentials";
import { makeStyles } from "tss-react/mui";

import { PanelExtensionContext, SettingsTreeAction, Subscription, Topic } from "@foxglove/studio";
import {
  PanelContextMenu,
  PanelContextMenuItem,
} from "@foxglove/studio-base/components/PanelContextMenu";
import Stack from "@foxglove/studio-base/components/Stack";
import { useAnalytics } from "@foxglove/studio-base/context/AnalyticsContext";
import { AppEvent } from "@foxglove/studio-base/services/IAnalytics";
import inScreenshotTests from "@foxglove/studio-base/stories/inScreenshotTests";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";
import { CameraInfo } from "@foxglove/studio-base/types/Messages";
import { mightActuallyBePartial } from "@foxglove/studio-base/util/mightActuallyBePartial";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";
import { formatTimeRaw } from "@foxglove/studio-base/util/time";

import { ImageCanvas, ImageEmptyState, Toolbar } from "./components";
import { useImagePanelMessages } from "./hooks";
import { CALIBRATION_DATATYPES } from "./hooks/normalizeCameraInfo";
import { downloadImage } from "./lib/downloadImage";
import { ANNOTATION_DATATYPES } from "./lib/normalizeAnnotations";
import { NORMALIZABLE_IMAGE_DATATYPES } from "./lib/normalizeMessage";
import { getRelatedMarkerTopics, getMarkerOptions, getCameraInfoTopic } from "./lib/util";
import { buildSettingsTree } from "./settings";
import type { Config, PixelData, RawMarkerData } from "./types";

type Props = {
  context: PanelExtensionContext;
};

const SUPPORTED_IMAGE_SCHEMAS = new Set(NORMALIZABLE_IMAGE_DATATYPES);
const SUPPORTED_ANNOTATION_SCHEMAS = new Set(ANNOTATION_DATATYPES);
const SUPPORTED_CALIBRATION_SCHEMAS = new Set(CALIBRATION_DATATYPES);

function topicIsConvertibleToSchema(topic: Topic, supportedSchemaNames: Set<string>): boolean {
  return (
    supportedSchemaNames.has(topic.schemaName) ||
    (topic.convertibleTo?.some((name) => supportedSchemaNames.has(name)) ?? false)
  );
}

function pickConvertToSchema(topic: Topic, supportedSchemaNames: Set<string>): string | undefined {
  if (supportedSchemaNames.has(topic.schemaName)) {
    // This topic schema is supported, don't use a conversion
    return undefined;
  }
  return topic.convertibleTo?.find((name) => supportedSchemaNames.has(name));
}

const useStyles = makeStyles<void, "timestamp">()((theme, _params, classes) => ({
  timestamp: {
    position: "absolute",
    margin: theme.spacing(0.5),
    right: 0,
    bottom: 0,
    fontFamily: fonts.MONOSPACE,
    color: theme.palette.common.white,
    zIndex: theme.zIndex.appBar - 1,
    transition: "opacity 0.1s ease-in-out",
    padding: theme.spacing(0.25, 0.5),
    userSelect: "all",
    textShadow: `0 1px 4px ${theme.palette.common.black}`,

    "@media (hover: hover)": {
      // only hide if the current device supports hover
      opacity: 0,
    },
  },
  root: {
    [`&:hover .${classes.timestamp}`]: {
      opacity: 1,
    },
  },
  screenshotTest: {
    [`.${classes.timestamp}`]: {
      opacity: 1,
    },
  },
}));

export function ImageView({ context }: Props): JSX.Element {
  const analytics = useAnalytics();
  const { classes, cx } = useStyles();
  const [renderDone, setRenderDone] = useState(() => () => {});
  const [topics, setTopics] = useState<readonly Topic[]>([]);
  const [config, setConfig] = useState<Config>(() => {
    const initialConfig = context.initialState as DeepPartial<Config> & {
      enabledMarkerTopics?: Config["enabledMarkerTopics"];
    };
    return {
      ...defaultConfig,
      ...initialConfig,
      pan: {
        x: initialConfig.pan?.x ?? 0,
        y: initialConfig.pan?.y ?? 0,
      },
    };
  });

  const { cameraTopic, enabledMarkerTopics, transformMarkers } = config;
  const topicsByTopicName = useMemo(() => keyBy(topics, ({ name }) => name), [topics]);
  const cameraTopicFullObject = useMemo(
    () => topicsByTopicName[cameraTopic],
    [cameraTopic, topicsByTopicName],
  );
  const [activePixelData, setActivePixelData] = useState<PixelData | undefined>();

  const shouldSynchronize = config.synchronize && enabledMarkerTopics.length > 0;

  const cameraInfoTopic = useMemo(() => getCameraInfoTopic(cameraTopic), [cameraTopic]);
  const cameraInfoTopicFullObject = useMemo(
    () => (cameraInfoTopic != undefined ? topicsByTopicName[cameraInfoTopic] : undefined),
    [cameraInfoTopic, topicsByTopicName],
  );

  const enabledMarkerTopicsFullObjects = useMemo(
    () => enabledMarkerTopics.map((topic) => topicsByTopicName[topic]),
    [enabledMarkerTopics, topicsByTopicName],
  );

  const subscriptions = useMemo<Subscription[]>(() => {
    const subs: Subscription[] = [];
    if (
      cameraTopicFullObject &&
      topicIsConvertibleToSchema(cameraTopicFullObject, SUPPORTED_IMAGE_SCHEMAS)
    ) {
      subs.push({
        topic: cameraTopicFullObject.name,
        preload: false,
        convertTo: pickConvertToSchema(cameraTopicFullObject, SUPPORTED_IMAGE_SCHEMAS),
      });
    }
    if (
      cameraInfoTopicFullObject &&
      topicIsConvertibleToSchema(cameraInfoTopicFullObject, SUPPORTED_CALIBRATION_SCHEMAS)
    ) {
      subs.push({
        topic: cameraInfoTopicFullObject.name,
        preload: false,
        convertTo: pickConvertToSchema(cameraInfoTopicFullObject, SUPPORTED_CALIBRATION_SCHEMAS),
      });
    }
    for (const topic of enabledMarkerTopicsFullObjects) {
      if (topic && topicIsConvertibleToSchema(topic, SUPPORTED_ANNOTATION_SCHEMAS)) {
        subs.push({
          topic: topic.name,
          preload: false,
          convertTo: pickConvertToSchema(topic, SUPPORTED_ANNOTATION_SCHEMAS),
        });
      }
    }
    return subs;
  }, [cameraTopicFullObject, cameraInfoTopicFullObject, enabledMarkerTopicsFullObjects]);

  const [colorScheme, setColorScheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    context.saveState(config);
    context.setDefaultPanelTitle(config.cameraTopic === "" ? undefined : config.cameraTopic);
  }, [config, context]);
  useEffect(() => {
    context.watch("topics");
    context.watch("didSeek");
    context.watch("currentFrame");
    context.watch("colorScheme");
  }, [context]);
  useEffect(() => {
    context.subscribe(subscriptions);
  }, [context, subscriptions]);

  const { image, annotations, cameraInfo, actions } = useImagePanelMessages({
    imageTopic: cameraTopic,
    cameraInfoTopic,
    annotationTopics: enabledMarkerTopics,
    synchronize: shouldSynchronize,
  });

  useEffect(() => {
    context.onRender = (renderState, done) => {
      ReactDOM.unstable_batchedUpdates(() => {
        if (renderState.topics) {
          setTopics(renderState.topics);
        }
        setRenderDone(() => done);
        if (renderState.didSeek ?? false) {
          actions.clear();
        }
        if (renderState.currentFrame) {
          actions.setCurrentFrame(renderState.currentFrame);
        }
        if (renderState.colorScheme) {
          setColorScheme(renderState.colorScheme);
        }
      });
    };
  }, [context, actions]);

  const imageTopics = useMemo(() => {
    return topics.filter((topic) => topicIsConvertibleToSchema(topic, SUPPORTED_IMAGE_SCHEMAS));
  }, [topics]);

  // If no cameraTopic is selected, automatically select the first available image topic
  useEffect(() => {
    const maybeCameraTopic = mightActuallyBePartial(config).cameraTopic;
    if (maybeCameraTopic == undefined || maybeCameraTopic === "") {
      const firstImageTopic = imageTopics[0];
      if (firstImageTopic && firstImageTopic.name !== "") {
        setConfig((oldConfig) => ({ ...oldConfig, cameraTopic: firstImageTopic.name }));
      }
    }
  }, [imageTopics, config]);

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

      setConfig((oldConfig) => ({
        ...oldConfig,
        cameraTopic: newCameraTopic,
        enabledMarkerTopics: newEnabledMarkerTopics,
      }));
    },
    [enabledMarkerTopics, topics],
  );

  const relatedMarkerTopics = useMemo(
    () => getMarkerOptions(config.cameraTopic, topics, ANNOTATION_DATATYPES),
    [config.cameraTopic, topics],
  );

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action !== "update") {
        return;
      }

      const { path, value } = action.payload;
      setConfig(
        produce<Config>((draft) => {
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
    [onChangeCameraTopic],
  );

  const markerTopics = useMemo(() => {
    return topics
      .filter((topic) => topicIsConvertibleToSchema(topic, SUPPORTED_ANNOTATION_SCHEMAS))
      .map((topic) => topic.name);
  }, [topics]);

  useEffect(() => {
    context.updatePanelSettingsEditor({
      actionHandler,
      nodes: buildSettingsTree({
        config,
        imageTopics,
        markerTopics,
        enabledMarkerTopics,
        relatedMarkerTopics,
      }),
    });
  }, [
    actionHandler,
    config,
    enabledMarkerTopics,
    imageTopics,
    markerTopics,
    relatedMarkerTopics,
    context,
  ]);

  const lastImageMessageRef = useRef(image);

  useEffect(() => {
    lastImageMessageRef.current = image;
  }, [image]);

  const doDownloadImage = useCallback(async () => {
    if (!lastImageMessageRef.current) {
      return;
    }

    const topic = imageTopics.find((top) => top.name === cameraTopic);
    if (!topic) {
      return;
    }

    void analytics.logEvent(AppEvent.IMAGE_DOWNLOAD, { legacy: true });
    await downloadImage(lastImageMessageRef.current, topic, config);
  }, [imageTopics, analytics, config, cameraTopic]);

  const contextMenuItemsForClickPosition = useCallback<() => PanelContextMenuItem[]>(
    () => [
      { type: "item", label: "Download image", onclick: doDownloadImage },
      { type: "divider" },
      {
        type: "item",
        label: "Flip horizontal",
        onclick: () =>
          setConfig((oldConfig) => ({
            ...oldConfig,
            flipHorizontal: !(oldConfig.flipHorizontal ?? false),
          })),
      },
      {
        type: "item",
        label: "Flip vertical",
        onclick: () =>
          setConfig((oldConfig) => ({
            ...oldConfig,
            flipVertical: !(oldConfig.flipVertical ?? false),
          })),
      },
      {
        type: "item",
        label: "Rotate 90°",
        onclick: () =>
          setConfig((oldConfig) => ({
            ...oldConfig,
            rotation: ((oldConfig.rotation ?? 0) + 90) % 360,
          })),
      },
    ],
    [doDownloadImage],
  );

  const rawMarkerData: RawMarkerData = useMemo(() => {
    return {
      markers: annotations,
      transformMarkers,
      // Convert to plain object before sending to web worker
      cameraInfo:
        (cameraInfo as { toJSON?: () => CameraInfo } | undefined)?.toJSON?.() ?? cameraInfo,
    };
  }, [annotations, cameraInfo, transformMarkers]);
  const saveConfigWithMerging = useCallback(
    (newConfig: Partial<Config>) => setConfig((oldConfig) => ({ ...oldConfig, ...newConfig })),
    [setConfig],
  );

  // Indicate render is complete - the effect runs after the dom is updated. It would be more
  // correct to call this inside the render callback from ImageCanvas (using onStartRenderImage).
  // However, the complexity of managing new frames (and new renderDone functions) coming in before
  // the old one finishes is pretty high and this is good enough for now.
  useEffect(() => {
    renderDone();
  }, [renderDone]);
  const onStartRenderImage = useCallback(() => {
    return () => {};
  }, []);

  return (
    <ThemeProvider isDark={colorScheme === "dark"}>
      <Stack
        flex="auto"
        overflow="hidden"
        fullWidth
        fullHeight
        position="relative"
        className={cx(classes.root, {
          [classes.screenshotTest]: inScreenshotTests(),
        })}
      >
        <PanelContextMenu itemsForClickPosition={contextMenuItemsForClickPosition} />
        <Stack fullWidth fullHeight>
          {/* Always render the ImageCanvas because it's expensive to unmount and start up. */}
          <ImageCanvas
            topic={cameraTopicFullObject}
            image={image}
            rawMarkerData={rawMarkerData}
            config={config}
            saveConfig={saveConfigWithMerging}
            onStartRenderImage={onStartRenderImage}
            setActivePixelData={setActivePixelData}
          />
          {/* If rendered, EmptyState will hide the always-present ImageCanvas */}
          {!image && (
            <ImageEmptyState
              cameraTopic={cameraTopic}
              markerTopics={enabledMarkerTopics}
              shouldSynchronize={shouldSynchronize}
            />
          )}
          {image && (
            <Typography
              className={classes.timestamp}
              fontFamily={fonts.MONOSPACE}
              variant="caption"
              align="right"
            >
              {formatTimeRaw(image.stamp)}
            </Typography>
          )}
        </Stack>
        <Toolbar pixelData={activePixelData} />
      </Stack>
    </ThemeProvider>
  );
}

export const defaultConfig: Config = {
  cameraTopic: "",
  enabledMarkerTopics: [],
  mode: "fit",
  pan: { x: 0, y: 0 },
  rotation: 0,
  synchronize: false,
  transformMarkers: false,
  zoom: 1,
};
