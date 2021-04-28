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

import { createMemoryHistory } from "history";
import { flatten } from "lodash";
import { ComponentProps } from "react";
import { DndProvider } from "react-dnd";
import HTML5Backend from "react-dnd-html5-backend";
import { Mosaic, MosaicNode, MosaicWindow } from "react-mosaic-component";

import {
  changePanelLayout,
  overwriteGlobalVariables,
  savePanelConfigs,
  setLinkedGlobalVariables,
  setUserNodes,
} from "@foxglove-studio/app/actions/panels";
import {
  setUserNodeDiagnostics,
  addUserNodeLogs,
  setUserNodeRosLib,
} from "@foxglove-studio/app/actions/userNodes";
import MockMessagePipelineProvider from "@foxglove-studio/app/components/MessagePipeline/MockMessagePipelineProvider";
import AppConfigurationContext, {
  AppConfiguration,
} from "@foxglove-studio/app/context/AppConfigurationContext";
import PanelCatalogContext, {
  PanelCatalog,
  PanelCategory,
  PanelInfo,
} from "@foxglove-studio/app/context/PanelCatalogContext";
import { GlobalVariables } from "@foxglove-studio/app/hooks/useGlobalVariables";
import { LinkedGlobalVariables } from "@foxglove-studio/app/panels/ThreeDimensionalViz/Interactions/useLinkedGlobalVariables";
import {
  UserNodeDiagnostics,
  UserNodeLogs,
} from "@foxglove-studio/app/players/UserNodePlayer/types";
import {
  Frame,
  Topic,
  PlayerStateActiveData,
  Progress,
  PublishPayload,
  AdvertisePayload,
} from "@foxglove-studio/app/players/types";
import createRootReducer from "@foxglove-studio/app/reducers";
import configureStore from "@foxglove-studio/app/store/configureStore.testing";
import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";
import { SavedProps, UserNodes } from "@foxglove-studio/app/types/panels";

type Store = ReturnType<typeof configureStore>;

export type Fixture = {
  frame: Frame;
  topics: Topic[];
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
  omitDragAndDrop: boolean;
  pauseFrame?: ComponentProps<typeof MockMessagePipelineProvider>["pauseFrame"];
  onMount?: (arg0: HTMLDivElement, store: Store) => void;
  onFirstMount?: (arg0: HTMLDivElement) => void;
  store?: Store;
  style?: {
    [key: string]: any;
  };
};

type State = {
  store: any;
  mockPanelCatalog: PanelCatalog;
  mockAppConfiguration: AppConfiguration;
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

export default class PanelSetup extends React.PureComponent<Props, State> {
  static defaultProps = {
    omitDragAndDrop: false,
  };
  static getDerivedStateFromProps(props: Props, prevState: State): Partial<State> {
    const { store } = prevState;
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
      store.dispatch(overwriteGlobalVariables(globalVariables));
    }
    if (userNodes) {
      store.dispatch(setUserNodes(userNodes));
    }
    if (layout !== undefined) {
      store.dispatch(changePanelLayout({ layout }));
    }
    if (linkedGlobalVariables) {
      store.dispatch(setLinkedGlobalVariables(linkedGlobalVariables));
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
      store.dispatch(
        savePanelConfigs({
          configs: Object.entries(savedProps).map(([id, config]: [string, any]) => ({
            id,
            config,
          })),
        }),
      );
    }
    return { store };
  }

  _hasMounted: boolean = false;

  constructor(props: Props) {
    super(props);
    this.state = {
      store: props.store ?? configureStore(createRootReducer(createMemoryHistory())),
      mockPanelCatalog: props.panelCatalog ?? new MockPanelCatalog(),
      mockAppConfiguration: {
        async set() {},
        async get() {},
        addChangeListener() {},
        removeChangeListener() {},
      },
    };
  }

  renderInner(): JSX.Element {
    const {
      frame = {},
      topics = [],
      datatypes,
      capabilities,
      activeData,
      progress,
      publish,
      setPublishers,
    } = this.props.fixture ?? {};
    let dTypes = datatypes;
    if (!dTypes) {
      const dummyDatatypes: RosDatatypes = {};
      for (const { datatype } of topics) {
        dummyDatatypes[datatype] = { fields: [] };
      }
      dTypes = dummyDatatypes;
    }
    const allData = flatten(Object.values(frame));
    return (
      <div
        style={{ width: "100%", height: "100%", display: "flex", ...this.props.style }}
        ref={(el) => {
          const { onFirstMount, onMount } = this.props;
          if (el && onFirstMount && !this._hasMounted) {
            this._hasMounted = true;
            onFirstMount(el);
          }
          if (el && onMount) {
            onMount(el, this.state.store);
          }
        }}
      >
        <MockMessagePipelineProvider
          capabilities={capabilities}
          topics={topics}
          datatypes={dTypes}
          messages={allData}
          pauseFrame={this.props.pauseFrame}
          activeData={activeData}
          progress={progress}
          store={this.state.store}
          publish={publish}
          setPublishers={setPublishers}
        >
          <PanelCatalogContext.Provider value={this.state.mockPanelCatalog}>
            <AppConfigurationContext.Provider value={this.state.mockAppConfiguration}>
              {this.props.children}
            </AppConfigurationContext.Provider>
          </PanelCatalogContext.Provider>
        </MockMessagePipelineProvider>
      </div>
    );
  }

  render(): JSX.Element {
    return this.props.omitDragAndDrop ? (
      this.renderInner()
    ) : (
      <MosaicWrapper>{this.renderInner()}</MosaicWrapper>
    );
  }
}
