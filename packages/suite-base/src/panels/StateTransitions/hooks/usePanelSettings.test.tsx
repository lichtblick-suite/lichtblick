/** @jest-environment jsdom */
// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { act, renderHook, RenderHookResult } from "@testing-library/react";
import { t, TFunction } from "i18next";
import { produce } from "immer";
import * as _ from "lodash-es";
import { PropsWithChildren } from "react";

import { SettingsTreeAction } from "@lichtblick/suite";
import MockPanelContextProvider from "@lichtblick/suite-base/components/MockPanelContextProvider";
import { DEFAULT_STATE_TRANSITION_PATH } from "@lichtblick/suite-base/panels/StateTransitions/constants";
import {
  buildSettingsTree,
  makeRootSeriesNode,
  makeSeriesNode,
  setSeriesAction,
  usePanelSettings,
} from "@lichtblick/suite-base/panels/StateTransitions/hooks/usePanelSettings";
import {
  IUsePanelSettings,
  PathState,
  SeriesAction,
  SeriesActionId,
  StateTransitionConfig,
  StateTransitionPath,
} from "@lichtblick/suite-base/panels/StateTransitions/types";
import { PLOTABLE_ROS_TYPES } from "@lichtblick/suite-base/panels/shared/constants";
import { PanelStateContextProvider } from "@lichtblick/suite-base/providers/PanelStateContextProvider";
import { SaveConfig } from "@lichtblick/suite-base/types/panels";
import { TimestampMethod } from "@lichtblick/suite-base/util/time";
import { BasicBuilder } from "@lichtblick/test-builders";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: jest.fn().mockImplementation((key) => key),
  }),
}));

interface IUsePanelSettingsSetup<T> {
  config: StateTransitionConfig;
  focusedPath: string[];
  render: RenderHookResult<T, unknown>;
}

const buildPath = (): StateTransitionPath => ({
  label: BasicBuilder.string(),
  value: BasicBuilder.string(),
  timestampMethod: BasicBuilder.sample<TimestampMethod>(["receiveTime", "headerStamp"]),
});

describe("setSeriesAction", () => {
  it("should return the SettingsTreeNodeActionItem", () => {
    const seriesActions: SeriesAction = {
      id: BasicBuilder.string(),
      label: BasicBuilder.string(),
      icon: "Add",
    };

    const { display, type, id, label, icon } = setSeriesAction(seriesActions);

    expect(display).toBe("inline");
    expect(type).toBe("action");
    expect(id).toBe(seriesActions.id);
    expect(icon).toBe(seriesActions.icon);
    expect(label).toBe(seriesActions.label);
  });
});

describe("makeSeriesNode", () => {
  const setup = (propsOverride: Partial<PathState & { canDelete: boolean }> = {}) => {
    const seriesNode: PathState & { canDelete: boolean } = {
      path: {
        value: BasicBuilder.string(),
        label: BasicBuilder.string(),
        timestampMethod: BasicBuilder.sample(["receiveTime", "headerStamp"]),
      },
      canDelete: true,
      isArray: false,
      ...propsOverride,
    };

    return {
      index: 0,
      seriesNode,
    };
  };

  it("should return the node structure with actions when canDelete is true", () => {
    const { seriesNode, index } = setup();

    const { actions, label, fields } = makeSeriesNode(
      index,
      seriesNode,
      t as unknown as TFunction<"stateTransitions">,
    );

    expect(actions).toEqual([
      {
        display: "inline",
        icon: "Clear",
        id: SeriesActionId.DELETE,
        label: "labels.deleteSeries",
        type: "action",
      },
    ]);
    expect(label).toEqual(seriesNode.path.label);
    expect(fields!.value).toEqual({
      input: "messagepath",
      label: "labels.messagePath",
      validTypes: PLOTABLE_ROS_TYPES,
      value: seriesNode.path.value,
    });
    expect(fields!.label).toEqual({
      input: "string",
      label: "labels.label",
      value: seriesNode.path.label,
    });
    expect(fields!.timestampMethod).toEqual({
      input: "select",
      label: "labels.timestamp",
      options: [
        { label: "labels.timestampReceiveTime", value: "receiveTime" },
        { label: "labels.timestampHeaderStamp", value: "headerStamp" },
      ],
      value: seriesNode.path.timestampMethod,
    });
  });

  it("should return the node structure with actions when canDelete is false", () => {
    const { seriesNode, index } = setup({ canDelete: false });

    const { actions } = makeSeriesNode(
      index,
      seriesNode,
      t as unknown as TFunction<"stateTransitions">,
    );

    expect(actions).toEqual([]);
  });

  it("should return error parameter in value field when isArray is true", () => {
    const { seriesNode, index } = setup({ isArray: true });

    const { fields } = makeSeriesNode(
      index,
      seriesNode,
      t as unknown as TFunction<"stateTransitions">,
    );

    expect(fields!.value).toEqual(expect.objectContaining({ error: "pathErrorMessage" }));
  });
});

describe("makeRootSeriesNode", () => {
  const setup = (paths?: PathState[]): { paths: PathState[] } => {
    const defaultPaths: PathState[] = paths ?? [
      { path: buildPath(), isArray: false },
      { path: buildPath(), isArray: false },
      { path: buildPath(), isArray: false },
    ];

    return {
      paths: defaultPaths,
    };
  };

  it("should return node structure with actions when paths are provided", () => {
    const { paths } = setup();

    const { label, children, actions } = makeRootSeriesNode(
      paths,
      t as unknown as TFunction<"stateTransitions">,
    );

    expect(label).toEqual("labels.series");
    expect(actions).toEqual([
      {
        display: "inline",
        icon: "Addchart",
        id: SeriesActionId.ADD,
        label: "labels.addSeries",
        type: "action",
      },
    ]);
    expect(_.size(children)).toBe(3);
    expect(children).toHaveProperty("0");
    expect(children).toHaveProperty("1");
    expect(children).toHaveProperty("2");
    expect(children!["0"]?.actions).toHaveLength(1);
    expect(children!["1"]?.actions).toHaveLength(1);
    expect(children!["2"]?.actions).toHaveLength(1);
  });

  it("should return node structure with actions when paths are not provided", () => {
    const { paths } = setup([]);

    const { children } = makeRootSeriesNode(paths, t as unknown as TFunction<"stateTransitions">);

    expect(_.size(children)).toBe(1);
    expect(children).toHaveProperty("0");
    expect(children).not.toHaveProperty("1");
    expect(children!["0"]?.actions).toEqual([]);
  });
});

describe("buildSettingsTree", () => {
  const setup = ({
    config = {},
    paths = undefined,
  }: Partial<{
    config: Partial<Omit<StateTransitionConfig, "paths">>;
    paths: PathState[] | undefined;
  }> = {}): { paths: PathState[]; config: Omit<StateTransitionConfig, "paths"> } => {
    const defaultPaths: PathState[] = paths ?? [
      { path: buildPath(), isArray: false },
      { path: buildPath(), isArray: false },
      { path: buildPath(), isArray: false },
    ];

    const defaultConfig: Omit<StateTransitionConfig, "paths"> = {
      isSynced: BasicBuilder.boolean(),
      showPoints: BasicBuilder.boolean(),
      xAxisMaxValue: BasicBuilder.number({ min: 50, max: 100 }),
      xAxisMinValue: BasicBuilder.number({ min: 0, max: 49 }),
      xAxisRange: BasicBuilder.number(),
      ...config,
    };

    return {
      paths: defaultPaths,
      config: defaultConfig,
    };
  };

  it("should build settings tree nodes", () => {
    const { paths, config } = setup();

    const {
      general,
      xAxis,
      paths: pathsResult,
    } = buildSettingsTree(
      config as StateTransitionConfig,
      paths,
      t as unknown as TFunction<"stateTransitions">,
    );

    // General settings
    expect(general).toBeDefined();
    expect(general!.label).toEqual("labels.general");
    expect(general!.fields!.isSynced).toEqual({
      label: "labels.sync",
      input: "boolean",
      value: config.isSynced,
    });

    // X axis settings
    expect(xAxis).toBeDefined();
    expect(xAxis!.label).toEqual("xAxis");
    expect(xAxis!.fields!.xAxisMaxValue!.label).toEqual("max");
    expect(xAxis!.fields!.xAxisMaxValue!.value).toEqual(config.xAxisMaxValue);
    expect(xAxis!.fields!.xAxisMinValue!.label).toEqual("min");
    expect(xAxis!.fields!.xAxisMinValue!.value).toEqual(config.xAxisMinValue);

    // Paths settings
    expect(pathsResult).toBeDefined();
  });

  it("should return error when xAxisMinValue is greater or equal to xAxisMaxValue", () => {
    const { paths, config } = setup({
      config: {
        xAxisMaxValue: BasicBuilder.number({ min: 0, max: 50 }),
        xAxisMinValue: BasicBuilder.number({ min: 50, max: 100 }),
      },
    });

    const { xAxis } = buildSettingsTree(
      config as StateTransitionConfig,
      paths,
      t as unknown as TFunction<"stateTransitions">,
    );

    expect(xAxis!.fields!.xAxisMaxValue!.error).toEqual("maxXError");
  });
});

describe("usePanelSettings", () => {
  let saveConfig: SaveConfig<StateTransitionConfig> = jest.fn();

  beforeEach(() => {
    saveConfig = jest.fn();
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  const setup = ({
    config = {},
    focusedPath = undefined,
    paths = undefined,
  }: Partial<{
    config: Partial<StateTransitionConfig>;
    paths: PathState[] | undefined;
    focusedPath: string[] | undefined;
  }> = {}): IUsePanelSettingsSetup<IUsePanelSettings> => {
    const defaultPaths: PathState[] = paths ?? [
      { path: buildPath(), isArray: false },
      { path: buildPath(), isArray: false },
      { path: buildPath(), isArray: false },
    ];
    const xAxisMaxValue = BasicBuilder.number({ min: 5, max: 10 });
    const xAxisMinValue = BasicBuilder.number({ min: 1, max: 4 });
    const defaultConfig: StateTransitionConfig = {
      isSynced: BasicBuilder.boolean(),
      showPoints: BasicBuilder.boolean(),
      xAxisMaxValue,
      xAxisMinValue,
      xAxisRange: xAxisMaxValue + xAxisMinValue,
      paths: defaultPaths.map(({ path }) => path),
      ...config,
    };

    const defaultFocusedPath: string[] = focusedPath ?? BasicBuilder.strings();

    const render = renderHook(
      () => usePanelSettings(defaultConfig, saveConfig, defaultPaths, defaultFocusedPath),
      {
        wrapper({ children }: PropsWithChildren) {
          return (
            <MockPanelContextProvider>
              <PanelStateContextProvider>{children}</PanelStateContextProvider>
            </MockPanelContextProvider>
          );
        },
      },
    );

    return {
      config: defaultConfig,
      focusedPath: defaultFocusedPath,
      render,
    };
  };

  it("should update config when isSynced changes", () => {
    const { config } = setup();

    act(() => {
      saveConfig({ isSynced: !config.isSynced });
    });

    expect(saveConfig).toHaveBeenCalledWith({
      isSynced: !config.isSynced,
    });
  });

  it("should update config with updated config for action 'update' - isSynced", () => {
    const { render } = setup({
      config: {
        isSynced: false,
      },
      paths: [],
    });
    const { actionHandler } = render.result.current;

    const action: SettingsTreeAction = {
      action: "update",
      payload: {
        input: "boolean",
        path: ["general", "isSynced"],
        value: true,
      },
    };

    act(() => {
      actionHandler(action);
    });

    expect(saveConfig).toHaveBeenCalledWith({
      isSynced: action.payload.value,
    });
  });

  it("should update config with updated config for action 'update' - showPoints", () => {
    const { render } = setup({
      config: {
        showPoints: false,
      },
      paths: [],
    });
    const { actionHandler } = render.result.current;

    const action: SettingsTreeAction = {
      action: "update",
      payload: {
        input: "boolean",
        path: ["general", "showPoints"],
        value: true,
      },
    };

    act(() => {
      actionHandler(action);
    });

    expect(saveConfig).toHaveBeenCalledWith({
      showPoints: action.payload.value,
    });
  });

  it("should update config with xAxisRange reseted when xAxisMinValue is updated", () => {
    const { render, config } = setup();
    const settings: SettingsTreeAction = {
      action: "update",
      payload: {
        input: "number",
        path: ["xAxis", "xAxisMinValue"],
        value: BasicBuilder.number(),
      },
    };
    const { actionHandler } = render.result.current;

    act(() => {
      actionHandler(settings);
    });

    expect(saveConfig).toHaveBeenCalledTimes(1);
    expect(saveConfig).toHaveBeenCalledWith(expect.any(Function));
    expect(
      produce(
        config,
        (saveConfig as jest.Mock).mock.calls[0][0] as (draft: StateTransitionConfig) => void,
      ),
    ).toEqual(
      expect.objectContaining({
        xAxisMaxValue: config.xAxisMaxValue,
        xAxisMinValue: settings.payload.value,
        xAxisRange: undefined,
      }),
    );
  });

  it("should update config with xAxisRange reseted when xAxisMaxValue is updated", () => {
    const { render, config } = setup();
    const settings: SettingsTreeAction = {
      action: "update",
      payload: {
        input: "number",
        path: ["xAxis", "xAxisMaxValue"],
        value: BasicBuilder.number(),
      },
    };
    const { actionHandler } = render.result.current;

    act(() => {
      actionHandler(settings);
    });

    expect(saveConfig).toHaveBeenCalledTimes(1);
    expect(saveConfig).toHaveBeenCalledWith(expect.any(Function));
    expect(
      produce(
        config,
        (saveConfig as jest.Mock).mock.calls[0][0] as (draft: StateTransitionConfig) => void,
      ),
    ).toEqual(
      expect.objectContaining({
        xAxisMaxValue: settings.payload.value,
        xAxisMinValue: config.xAxisMinValue,
        xAxisRange: undefined,
      }),
    );
  });

  it("should update config with xAxisMinValue and xAxisMaxValue reseted when xAxisRange is updated", () => {
    const { render, config } = setup();
    const settings: SettingsTreeAction = {
      action: "update",
      payload: {
        input: "number",
        path: ["xAxis", "xAxisRange"],
        value: BasicBuilder.number(),
      },
    };
    const { actionHandler } = render.result.current;

    act(() => {
      actionHandler(settings);
    });

    expect(saveConfig).toHaveBeenCalledTimes(1);
    expect(saveConfig).toHaveBeenCalledWith(expect.any(Function));
    expect(
      produce(
        config,
        (saveConfig as jest.Mock).mock.calls[0][0] as (draft: StateTransitionConfig) => void,
      ),
    ).toEqual(
      expect.objectContaining({
        xAxisMaxValue: undefined,
        xAxisMinValue: undefined,
        xAxisRange: settings.payload.value,
      }),
    );
  });

  it("should update config when there is no path", () => {
    const { render, config } = setup({ paths: [] });
    const settings: SettingsTreeAction = {
      action: "update",
      payload: {
        input: "number",
        path: [],
        value: BasicBuilder.number(),
      },
    };
    const { actionHandler } = render.result.current;

    act(() => {
      actionHandler(settings);
    });

    const updatedConfig = produce(
      config,
      (saveConfig as jest.Mock).mock.calls[0][0] as (draft: StateTransitionConfig) => void,
    );
    expect(saveConfig).toHaveBeenCalledTimes(1);
    expect(saveConfig).toHaveBeenCalledWith(expect.any(Function));
    expect(updatedConfig.paths).toEqual([DEFAULT_STATE_TRANSITION_PATH]);
  });

  it("should update config when there are paths", () => {
    const { render, config } = setup();
    const settings: SettingsTreeAction = {
      action: "update",
      payload: {
        input: "number",
        path: [],
        value: BasicBuilder.number(),
      },
    };
    const { actionHandler } = render.result.current;

    act(() => {
      actionHandler(settings);
    });

    const updatedConfig = produce(
      config,
      (saveConfig as jest.Mock).mock.calls[0][0] as (draft: StateTransitionConfig) => void,
    );
    expect(saveConfig).toHaveBeenCalledTimes(1);
    expect(saveConfig).toHaveBeenCalledWith(expect.any(Function));
    expect(updatedConfig.paths).toEqual(config.paths);
  });

  it.each<{ paths: StateTransitionPath[] }>([
    { paths: [] },
    { paths: [DEFAULT_STATE_TRANSITION_PATH] },
  ])("should add a serie", ({ paths }) => {
    const { render, config } = setup();
    config.paths = paths;

    const { actionHandler } = render.result.current;

    const settings: SettingsTreeAction = {
      action: "perform-node-action",
      payload: { id: SeriesActionId.ADD, path: [] },
    };

    actionHandler(settings);

    expect(saveConfig).toHaveBeenCalledTimes(1);
    expect(saveConfig).toHaveBeenCalledWith(expect.any(Function));
    const updatedConfig = produce(
      config,
      (saveConfig as jest.Mock).mock.calls[0][0] as (draft: StateTransitionConfig) => void,
    );
    expect(updatedConfig.paths).toHaveLength(2);
    expect(updatedConfig.paths).toEqual([
      DEFAULT_STATE_TRANSITION_PATH,
      DEFAULT_STATE_TRANSITION_PATH,
    ]);
  });

  it("should delete a serie", () => {
    const { render, config } = setup();

    const { actionHandler } = render.result.current;

    const settings: SettingsTreeAction = {
      action: "perform-node-action",
      payload: { id: SeriesActionId.DELETE, path: ["", "2"] },
    };

    actionHandler(settings);

    expect(saveConfig).toHaveBeenCalledTimes(1);
    expect(saveConfig).toHaveBeenCalledWith(expect.any(Function));
    const updatedConfig = produce(
      config,
      (saveConfig as jest.Mock).mock.calls[0][0] as (draft: StateTransitionConfig) => void,
    );
    expect(updatedConfig.paths).toHaveLength(2);
    expect(updatedConfig.paths).toContain(config.paths[0]);
    expect(updatedConfig.paths).toContain(config.paths[1]);
    expect(updatedConfig.paths).not.toContain(config.paths[2]);
  });
});
