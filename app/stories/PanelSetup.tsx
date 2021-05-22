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

import { flatten } from "lodash";
import { ComponentProps, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Mosaic, MosaicNode, MosaicWindow } from "react-mosaic-component";

import {
  setUserNodeDiagnostics,
  addUserNodeLogs,
  setUserNodeRosLib,
} from "@foxglove/studio-base/actions/userNodes";
import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import AppConfigurationContext from "@foxglove/studio-base/context/AppConfigurationContext";
import CurrentLayoutContext, {
  CurrentLayoutActions,
  SelectedPanelActions,
  useCurrentLayoutActions,
  useSelectedPanels,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import PanelCatalogContext, {
  PanelCatalog,
  PanelCategory,
  PanelInfo,
} from "@foxglove/studio-base/context/PanelCatalogContext";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import { LinkedGlobalVariables } from "@foxglove/studio-base/panels/ThreeDimensionalViz/Interactions/useLinkedGlobalVariables";
import {
  UserNodeDiagnostics,
  UserNodeLogs,
} from "@foxglove/studio-base/players/UserNodePlayer/types";
import {
  Frame,
  Topic,
  PlayerStateActiveData,
  Progress,
  PublishPayload,
  AdvertisePayload,
} from "@foxglove/studio-base/players/types";
import CurrentLayoutState, {
  DEFAULT_LAYOUT_FOR_TESTS,
} from "@foxglove/studio-base/providers/CurrentLayoutProvider/CurrentLayoutState";
import createRootReducer from "@foxglove/studio-base/reducers";
import configureStore from "@foxglove/studio-base/store/configureStore.testing";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import { SavedProps, UserNodes } from "@foxglove/studio-base/types/panels";

type Store = ReturnType<typeof configureStore>;

export type Fixture = {
  frame?: Frame;
  topics?: Topic[];
  capabilities?: string[];
  activeData?: Partial<PlayerStateActiveData>;
  progress?: Progress;
  datatypes?: RosDatatypes;
  globalVariables?: GlobalVariables;
  layout?: MosaicNode<string>;
  linkedGlobalVariables?: LinkedGlobalVariables;
  userNodes?: UserNodes;
  userNodeDiagnostics?: UserNodeDiagnostics;
  userNodeFlags?: { id: string };
  userNodeLogs?: UserNodeLogs;
  userNodeRosLib?: string;
  savedProps?: SavedProps;
  publish?: (request: PublishPayload) => void;
  setPublishers?: (arg0: string, arg1: AdvertisePayload[]) => void;
};

type Props = {
  children: React.ReactNode;
  fixture?: Fixture;
  panelCatalog?: PanelCatalog;
  omitDragAndDrop?: boolean;
  pauseFrame?: ComponentProps<typeof MockMessagePipelineProvider>["pauseFrame"];
  onMount?: (
    arg0: HTMLDivElement,
    store: Store,
    actions: CurrentLayoutActions,
    selectedPanelActions: SelectedPanelActions,
  ) => void;
  onFirstMount?: (arg0: HTMLDivElement) => void;
  store?: Store;
  style?: {
    [key: string]: any;
  };
};

function setNativeValue(element: unknown, value: unknown) {
  const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set; // eslint-disable-line @typescript-eslint/unbound-method
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set; // eslint-disable-line @typescript-eslint/unbound-method
  if (valueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter?.call(element, value);
  } else {
    valueSetter?.call(element, value);
  }
}

export function triggerInputChange(
  node: HTMLInputElement | HTMLTextAreaElement,
  value: string = "",
): void {
  // force trigger textarea to change
  node.value = `${value} `;
  // trigger input change: https://stackoverflow.com/questions/23892547/what-is-the-best-way-to-trigger-onchange-event-in-react-js
  setNativeValue(node, value);

  const ev = new Event("input", { bubbles: true });
  node.dispatchEvent(ev);
}

export function triggerInputBlur(node: HTMLInputElement | HTMLTextAreaElement): void {
  const ev = new Event("blur", { bubbles: true });
  node.dispatchEvent(ev);
}

export function triggerWheel(target: HTMLElement, deltaX: number): void {
  const event = document.createEvent("MouseEvents");
  event.initEvent("wheel", true, true);
  (event as any).deltaX = deltaX;
  target.dispatchEvent(event);
}

export const MosaicWrapper = ({ children }: { children: React.ReactNode }): JSX.Element => {
  return (
    <DndProvider backend={HTML5Backend}>
      <Mosaic
        className="none"
        initialValue="mock"
        renderTile={(_id, path) => {
          return (
            <MosaicWindow title="" path={path} renderPreview={() => <div />}>
              {children}
            </MosaicWindow>
          );
        }}
      />
    </DndProvider>
  );
};

// empty catalog if one is not provided via props
class MockPanelCatalog implements PanelCatalog {
  getPanelCategories(): PanelCategory[] {
    return [];
  }
  getPanelsByCategory(): Map<string, PanelInfo[]> {
    return new Map();
  }
  getPanelsByType(): Map<string, PanelInfo> {
    return new Map();
  }
  getComponentForType(_type: string): PanelInfo["component"] | undefined {
    return undefined;
  }
}

function UnconnectedPanelSetup(props: Props): JSX.Element | ReactNull {
  const [store] = useState(() => props.store ?? configureStore(createRootReducer()));
  const [mockPanelCatalog] = useState(() => props.panelCatalog ?? new MockPanelCatalog());
  const [mockAppConfiguration] = useState(() => ({
    get() {
      return undefined;
    },
    async set() {},
    addChangeListener() {},
    removeChangeListener() {},
  }));

  const hasMounted = useRef(false);

  const actions = useCurrentLayoutActions();
  const selectedPanels = useSelectedPanels();

  const [initialized, setInitialized] = useState(false);
  useLayoutEffect(() => {
    if (initialized) {
      return;
    }
    const {
      globalVariables,
      userNodes,
      layout,
      linkedGlobalVariables,
      userNodeDiagnostics,
      userNodeLogs,
      userNodeRosLib,
      savedProps,
    } = props.fixture ?? {};
    if (globalVariables) {
      actions.overwriteGlobalVariables(globalVariables);
    }
    if (userNodes) {
      actions.setUserNodes(userNodes);
    }
    if (layout !== undefined) {
      actions.changePanelLayout({ layout });
    }
    if (linkedGlobalVariables) {
      actions.setLinkedGlobalVariables(linkedGlobalVariables);
    }
    if (userNodeDiagnostics) {
      store.dispatch(setUserNodeDiagnostics(userNodeDiagnostics));
    }
    if (userNodeLogs) {
      store.dispatch(addUserNodeLogs(userNodeLogs));
    }
    if (userNodeRosLib != undefined) {
      store.dispatch(setUserNodeRosLib(userNodeRosLib));
    }
    if (savedProps) {
      actions.savePanelConfigs({
        configs: Object.entries(savedProps).map(([id, config]: [string, any]) => ({ id, config })),
      });
    }
    setInitialized(true);
  }, [initialized, props.fixture, store, actions]);

  const {
    frame = {},
    topics = [],
    datatypes,
    capabilities,
    activeData,
    progress,
    publish,
    setPublishers,
  } = props.fixture ?? {};
  let dTypes = datatypes;
  if (!dTypes) {
    const dummyDatatypes: RosDatatypes = {};
    for (const { datatype } of topics) {
      dummyDatatypes[datatype] = { fields: [] };
    }
    dTypes = dummyDatatypes;
  }
  const allData = flatten(Object.values(frame));
  const inner = (
    <div
      style={{ width: "100%", height: "100%", display: "flex", ...props.style }}
      ref={(el) => {
        const { onFirstMount, onMount } = props;
        if (el && onFirstMount && !hasMounted.current) {
          hasMounted.current = true;
          onFirstMount(el);
        }
        if (el && onMount) {
          onMount(el, store, actions, selectedPanels);
        }
      }}
    >
      <MockMessagePipelineProvider
        capabilities={capabilities}
        topics={topics}
        datatypes={dTypes}
        messages={allData}
        pauseFrame={props.pauseFrame}
        activeData={activeData}
        progress={progress}
        store={store}
        publish={publish}
        setPublishers={setPublishers}
      >
        <PanelCatalogContext.Provider value={mockPanelCatalog}>
          <AppConfigurationContext.Provider value={mockAppConfiguration}>
            {props.children}
          </AppConfigurationContext.Provider>
        </PanelCatalogContext.Provider>
      </MockMessagePipelineProvider>
    </div>
  );

  // Wait to render children until we've initialized state as requested in the fixture
  if (!initialized) {
    return ReactNull;
  }

  const { omitDragAndDrop = false } = props;
  return omitDragAndDrop ? inner : <MosaicWrapper>{inner}</MosaicWrapper>;
}

export default function PanelSetup(props: Props): JSX.Element {
  const currentLayout = useMemo(() => new CurrentLayoutState(DEFAULT_LAYOUT_FOR_TESTS), []);
  return (
    <CurrentLayoutContext.Provider value={currentLayout}>
      <UnconnectedPanelSetup {...props} />
    </CurrentLayoutContext.Provider>
  );
}
