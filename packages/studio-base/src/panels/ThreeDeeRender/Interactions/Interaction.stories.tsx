// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Stack } from "@mui/material";
import { storiesOf } from "@storybook/react";
import styled from "styled-components";

import MockPanelContextProvider from "@foxglove/studio-base/components/MockPanelContextProvider";
import { decodeMarker } from "@foxglove/studio-base/panels/ThreeDimensionalViz/commands/PointClouds/decodeMarker";
import {
  POINT_CLOUD_MESSAGE,
  POINT_CLOUD_WITH_ADDITIONAL_FIELDS,
} from "@foxglove/studio-base/panels/ThreeDimensionalViz/commands/PointClouds/fixture/pointCloudData";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import Interactions, { OBJECT_TAB_TYPE, LINKED_VARIABLES_TAB_TYPE } from "./Interactions";

const SWrapper = styled.div`
  background: ${({ theme }) => theme.palette.neutralLighterAlt};
  display: flex;
  flex-wrap: wrap;
  height: 100%;
`;

const markerObject = {
  id: "12345",
  header: { frame_id: "some_frame", stamp: { sec: 0, nsec: 0 } },
  action: 0,
  ns: "",
  text: "hello\nthere",
  type: 0,
  scale: {
    x: 2,
    y: 2,
    z: 4,
  },
  color: {
    r: 1,
    g: 0.1,
    b: 0,
    a: 0.7,
  },
  pose: {
    position: {
      x: -1,
      y: 1,
      z: -5,
    },
    orientation: {
      x: 0,
      y: 0,
      z: 0,
      w: 1,
    },
  },
};

const interactiveMarkerObject = {
  ...markerObject,
  interactionData: { topic: "/foo/bar", originalMessage: markerObject },
};
const selectedObject = { object: interactiveMarkerObject, instanceIndex: undefined };

const sharedProps = {
  selectedObject,
  interactionsTabType: OBJECT_TAB_TYPE,
  setInteractionsTabType: () => {
    // no-op
  },
};

function PanelSetupWithData({
  children,
  title,
  onMount,
  disableAutoOpenClickedObject = true,
}: {
  children: React.ReactNode;
  title: React.ReactNode;
  onMount?: (el: HTMLDivElement) => void;
  disableAutoOpenClickedObject?: boolean;
}) {
  return (
    <PanelSetup
      omitDragAndDrop
      style={{ width: "auto", height: "auto", display: "inline-flex" }}
      fixture={{
        topics: [],
        datatypes: new Map(),
        frame: {},
        linkedGlobalVariables: [
          {
            topic: "/foo/bar",
            markerKeyPath: ["frame_id", "header"],
            name: "some_val",
          },
          {
            topic: "/foo/bar",
            markerKeyPath: ["type"],
            name: "type",
          },
          {
            topic: "/foo/bar",
            markerKeyPath: ["action"],
            name: "some_val",
          },
          {
            topic: "/some_topic",
            markerKeyPath: ["scale"],
            name: "scale",
          },
          {
            topic: "/other_topic",
            markerKeyPath: ["scale"],
            name: "scale",
          },
          {
            topic: "/foo/bar",
            markerKeyPath: ["y", "some_very_very_long_path"],
            name: "scaleY",
          },
        ],
        globalVariables: {
          id: 100,
          scaleY: 2.4,
          fooScaleX: 3,
        },
      }}
    >
      <MockPanelContextProvider config={{ disableAutoOpenClickedObject }}>
        <div
          style={{ margin: 16 }}
          ref={(el) => {
            if (el && onMount) {
              onMount(el);
            }
          }}
        >
          <p>{title}</p>
          <Stack direction="row" flex="auto">
            {children}
          </Stack>
        </div>
      </MockPanelContextProvider>
    </PanelSetup>
  );
}

function DefaultStory() {
  return (
    <SWrapper>
      <PanelSetupWithData title="Link Tab">
        <Interactions
          {...(sharedProps as any)}
          selectedObject={undefined}
          interactionsTabType={LINKED_VARIABLES_TAB_TYPE}
        />
      </PanelSetupWithData>
      <PanelSetupWithData title="Default without clicked object">
        <Interactions
          {...(sharedProps as any)}
          selectedObject={undefined}
          interactionsTabType={OBJECT_TAB_TYPE}
        />
      </PanelSetupWithData>
      <PanelSetupWithData title="With interactionData">
        <Interactions {...(sharedProps as any)} />
      </PanelSetupWithData>
      <PanelSetupWithData
        title="Clicked link button"
        onMount={(el) => {
          const btn = el.querySelector("[data-testid='link-id']");
          if (btn) {
            (btn as any).click();
          }
        }}
      >
        <Interactions
          {...(sharedProps as any)}
          selectedObject={{ ...selectedObject, interactionData: { topic: "/foo/bar" } }}
        />
      </PanelSetupWithData>
      <PanelSetupWithData
        title="Add link to existing linked global variable"
        onMount={(el) => {
          const btn = el.querySelector("[data-testid='link-scale']");
          if (btn) {
            (btn as any).click();
          }
        }}
      >
        <Interactions
          {...(sharedProps as any)}
          selectedObject={{ ...selectedObject, interactionData: { topic: "/foo/bar" } }}
        />
      </PanelSetupWithData>
    </SWrapper>
  );
}

storiesOf("panels/ThreeDeeRender/Interactions/Interaction", module)
  .addParameters({
    chromatic: { viewport: { width: 1001, height: 1101 } },
  })
  .add("default", DefaultStory, { colorScheme: "dark" })
  .add("default light", DefaultStory, { colorScheme: "light" })
  .add("PointCloud", () => {
    const cloud1 = { ...selectedObject.object, ...decodeMarker(POINT_CLOUD_MESSAGE) };
    const cloud2 = {
      ...selectedObject.object,
      ...decodeMarker(POINT_CLOUD_WITH_ADDITIONAL_FIELDS),
    };

    return (
      <SWrapper>
        <PanelSetupWithData title="default with point color">
          <Interactions
            {...(sharedProps as any)}
            selectedObject={{
              instanceIndex: 0,
              object: {
                ...cloud1,
                type: 102,
                interactionData: { topic: "/foo/bar", originalMessage: POINT_CLOUD_MESSAGE },
              },
            }}
          />
        </PanelSetupWithData>
        <PanelSetupWithData title="with additional fields">
          <Interactions
            {...(sharedProps as any)}
            selectedObject={{
              instanceIndex: 0,
              object: {
                ...cloud2,
                type: 102,
                interactionData: {
                  topic: "/foo/bar",
                  originalMessage: POINT_CLOUD_WITH_ADDITIONAL_FIELDS,
                },
              },
            }}
          />
        </PanelSetupWithData>
      </SWrapper>
    );
  });
