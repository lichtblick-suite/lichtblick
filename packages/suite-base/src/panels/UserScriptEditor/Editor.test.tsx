/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, render, waitFor } from "@testing-library/react";
import * as monacoApi from "monaco-editor/esm/vs/editor/editor.api";

import { DEFAULT_STUDIO_SCRIPT_PREFIX } from "@lichtblick/suite-base/util/constants";
import { BasicBuilder } from "@lichtblick/test-builders";

import "@testing-library/jest-dom";

import Editor from "./Editor";
import { Script } from "./script";

let mockOpenHandler:
  | ((
      input: { resource: { path: string }; options?: { selection?: unknown } },
      editor: unknown,
    ) => Promise<unknown>)
  | undefined = undefined;

jest.mock("monaco-editor", () => ({
  typescript: {
    typescriptDefaults: {
      addExtraLib: jest.fn(() => ({ dispose: jest.fn() })),
      setEagerModelSync: jest.fn(),
      setDiagnosticsOptions: jest.fn(),
      setCompilerOptions: jest.fn(),
      getCompilerOptions: jest.fn(() => ({})),
    },
    javascriptDefaults: {
      setEagerModelSync: jest.fn(),
    },
  },
  KeyMod: { CtrlCmd: 1 },
  KeyCode: { KeyS: 55 },
}));

jest.mock("@lichtblick/suite-base/panels/UserScriptEditor/getPrettifiedCode", () =>
  jest.fn(async (code: string) => code),
);

type MockModel = {
  uri: { path: string; toString: () => string };
  value: string;
  options: Record<string, unknown>;
  getValue: jest.Mock<string, []>;
  setValue: jest.Mock<void, [string]>;
  updateOptions: jest.Mock<void, [Record<string, unknown>]>;
  getFullModelRange: jest.Mock<Record<string, never>, []>;
};
jest.mock("monaco-editor/esm/vs/editor/editor.api", () => {
  const models = new Map<string, MockModel>();

  const createModel = (
    value: string,
    _language: string,
    uri: { path: string; toString: () => string },
  ) => {
    const model: MockModel = {
      uri,
      value,
      options: {},
      getValue: jest.fn(() => model.value),
      setValue: jest.fn((next) => {
        model.value = next;
      }),
      updateOptions: jest.fn((opts) => {
        model.options = { ...model.options, ...opts };
      }),
      getFullModelRange: jest.fn(() => ({})),
    };
    models.set(uri.path, model);
    return model;
  };

  const getModel = (uri: { path: string; toString: () => string }) => models.get(uri.path);

  return {
    editor: {
      defineTheme: jest.fn(),
      createModel: jest.fn(
        (value: string, language: string, uri: { path: string; toString: () => string }) =>
          createModel(value, language, uri),
      ),
      getModel: jest.fn((uri: { path: string; toString: () => string }) => getModel(uri)),
    },
    languages: {
      registerDocumentFormattingEditProvider: jest.fn(),
    },
    Uri: {
      parse: jest.fn((value: string) => ({
        path: new URL(value).pathname,
        toString: () => value,
      })),
    },
    KeyMod: { CtrlCmd: 1 },
    KeyCode: { KeyS: 55 },
    clearModels: () => {
      models.clear();
    },
    __getModels: () => models,
  };
});

jest.mock("monaco-editor/esm/vs/editor/browser/services/codeEditorService", () => ({
  ICodeEditorService: Symbol("ICodeEditorService"),
}));

jest.mock("monaco-editor/esm/vs/editor/standalone/browser/standaloneServices", () => ({
  StandaloneServices: {
    get: jest.fn(() => ({
      registerCodeEditorOpenHandler: jest.fn((handler) => {
        mockOpenHandler = handler;
        return { dispose: jest.fn() };
      }),
    })),
  },
}));

let mockOnChange: ((code: string) => void) | undefined;
let mockEditor: ReturnType<typeof createMockEditor> | undefined;

const createMockEditor = () => {
  const actions = new Map<string, { run: jest.Mock }>();
  const formatAction = { run: jest.fn(async () => {}) };
  actions.set("editor.action.formatDocument", formatAction);
  let currentModel: MockModel | undefined;

  return {
    setModel: jest.fn((model: MockModel) => {
      currentModel = model;
    }),
    getModel: jest.fn(() => currentModel),
    addAction: jest.fn(({ id, run }: { id: string; run: () => Promise<void> | void }) => {
      actions.set(id, { run: jest.fn(run) });
    }),
    getAction: jest.fn((id: string) => actions.get(id)),
    setSelection: jest.fn(),
    revealRangeInCenter: jest.fn(),
    setPosition: jest.fn(),
    revealPositionInCenter: jest.fn(),
    layout: jest.fn(),
  };
};

jest.mock("react-monaco-editor", () => {
  return function MockMonacoEditor(props: {
    editorWillMount?: (monaco: unknown) => unknown;
    editorDidMount?: (editor: unknown, monaco: unknown) => void;
    onChange?: (code: string) => void;
  }) {
    const mockMonacoApi = jest.requireMock("monaco-editor/esm/vs/editor/editor.api");
    mockOnChange = props.onChange;
    mockEditor = createMockEditor();
    props.editorWillMount?.(mockMonacoApi);
    props.editorDidMount?.(mockEditor, mockMonacoApi);
    return undefined;
  };
});

jest.mock("@mui/material", () => ({
  useTheme: () => ({ palette: { mode: "dark" } }),
}));

jest.mock("react-resize-detector", () => ({
  useResizeDetector: jest.fn((opts?: unknown) => {
    resizeDetectorOptions = opts as {
      onResize?: (payload: { width?: number; height?: number }) => void;
    };
    return { ref: jest.fn() };
  }),
}));

let resizeDetectorOptions:
  | { onResize?: (payload: { width?: number; height?: number }) => void }
  | undefined;

const userScriptProjectConfig = {
  rosLib: { fileName: "ros-lib.d.ts" },
  declarations: [{ fileName: "types.d.ts", sourceCode: "// declarations" }],
  utilityFiles: [{ filePath: "/utility.ts", sourceCode: "export const util = 1;" }],
};

jest.mock(
  "@lichtblick/suite-base/players/UserScriptPlayer/transformerWorker/typescript/projectConfig",
  () => ({
    __esModule: true,
    getUserScriptProjectConfig: jest.fn(() => userScriptProjectConfig),
    __userScriptProjectConfig: userScriptProjectConfig,
  }),
);

jest.mock("@lichtblick/suite-base/stories/inScreenshotTests", () => jest.fn(() => false));

// Tests

describe("Editor", () => {
  let baseScript: Script;
  const buildScript = (overrides: Partial<Script> = {}): Script => ({
    filePath: `${BasicBuilder.string()}.ts`,
    code: BasicBuilder.string(),
    readOnly: false,
    ...overrides,
  });

  const renderEditor = (props: Partial<React.ComponentProps<typeof Editor>> = {}) => {
    const {
      autoFormatOnSave = false,
      script = baseScript,
      setScriptCode = jest.fn(),
      save = jest.fn(),
      setScriptOverride = jest.fn(),
      rosLib = BasicBuilder.string(),
      typesLib = BasicBuilder.string(),
    } = props;

    return render(
      <Editor
        autoFormatOnSave={autoFormatOnSave}
        script={script}
        setScriptCode={setScriptCode}
        save={save}
        setScriptOverride={setScriptOverride}
        rosLib={rosLib}
        typesLib={typesLib}
      />,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (monacoApi as unknown as { clearModels?: () => void }).clearModels?.();
    mockOnChange = undefined;
    mockEditor = undefined;
    mockOpenHandler = undefined;
    baseScript = buildScript();
    userScriptProjectConfig.rosLib = { fileName: "ros-lib.d.ts" };
    userScriptProjectConfig.declarations = [
      { fileName: "types.d.ts", sourceCode: "// declarations" },
    ];
    userScriptProjectConfig.utilityFiles = [
      { filePath: "/utility.ts", sourceCode: "export const util = 1;" },
    ];
  });

  it("Given auto-format is enabled When the save shortcut runs Then the editor formats and saves the script", async () => {
    const save = jest.fn();

    await act(async () => {
      renderEditor({ autoFormatOnSave: true, save });
    });

    await waitFor(() => {
      expect(mockEditor?.setModel).toHaveBeenCalled();
    });

    const saveAction = mockEditor?.getAction("ctrl-s");
    expect(saveAction).toBeDefined();

    await act(async () => {
      await saveAction?.run();
    });

    const formatAction = mockEditor?.getAction("editor.action.formatDocument");
    expect(formatAction?.run).toHaveBeenCalled();
    expect(save).toHaveBeenCalledWith(baseScript.code);
  });

  it("Given a read-only script When the save shortcut runs Then saving and formatting are skipped", async () => {
    const save = jest.fn();
    const readOnlyScript = buildScript({ readOnly: true });

    await act(async () => {
      renderEditor({ autoFormatOnSave: true, save, script: readOnlyScript });
    });

    const saveAction = mockEditor?.getAction("ctrl-s");
    expect(saveAction).toBeDefined();

    const formatAction = mockEditor?.getAction("editor.action.formatDocument");

    await act(async () => {
      await saveAction?.run();
    });

    expect(formatAction?.run).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("Given a request to open another model When the open handler runs Then the script override is populated", async () => {
    const setScriptOverride = jest.fn();
    const typesLib = BasicBuilder.string();

    await act(async () => {
      renderEditor({ setScriptOverride, typesLib });
    });

    expect(mockOpenHandler).toBeTruthy();

    // Create another model the handler should route to the override hook.

    const otherTypeName = BasicBuilder.string();
    const otherUri = monacoApi.Uri.parse(`file:///node_modules/@types/${otherTypeName}.d.ts`);
    monacoApi.editor.createModel(`interface ${otherTypeName} {}`, "typescript", otherUri);

    await act(async () => {
      await mockOpenHandler?.(
        {
          resource: otherUri,
          options: {
            selection: {
              startLineNumber: BasicBuilder.number(),
              startColumn: BasicBuilder.number(),
            },
          },
        },
        undefined,
      );
    });

    expect(setScriptOverride).toHaveBeenCalledWith({
      filePath: otherUri.path,
      code: `interface ${otherTypeName} {}`,
      readOnly: true,
      selection: expect.objectContaining({
        startLineNumber: expect.any(Number),
        startColumn: expect.any(Number),
      }),
    });
  });

  it("Given a jump inside the current script When the open handler runs Then it navigates without overriding", async () => {
    const setScriptOverride = jest.fn();
    const selection = {
      startLineNumber: BasicBuilder.number(),
      startColumn: BasicBuilder.number(),
      endLineNumber: BasicBuilder.number(),
      endColumn: BasicBuilder.number(),
    };

    await act(async () => {
      renderEditor({ setScriptOverride });
    });

    expect(mockOpenHandler).toBeTruthy();

    const basename = baseScript.filePath.split("/").pop() ?? baseScript.filePath;
    const currentFileUri = monacoApi.Uri.parse(`file://${DEFAULT_STUDIO_SCRIPT_PREFIX}${basename}`);

    await act(async () => {
      await mockOpenHandler?.(
        { resource: currentFileUri, options: { selection } },
        mockEditor ?? undefined,
      );
    });

    expect(setScriptOverride).not.toHaveBeenCalled();
    expect(mockEditor?.setSelection).toHaveBeenCalledWith(selection);
    expect(mockEditor?.revealRangeInCenter).toHaveBeenCalled();
  });

  it("Given a position-only selection When the open handler runs Then it sets the position instead of a range", async () => {
    const setScriptOverride = jest.fn();
    const selection = {
      startLineNumber: BasicBuilder.number(),
      startColumn: BasicBuilder.number(),
    };

    await act(async () => {
      renderEditor({ setScriptOverride });
    });

    const basename = baseScript.filePath.split("/").pop() ?? baseScript.filePath;
    const currentFileUri = monacoApi.Uri.parse(`file://${DEFAULT_STUDIO_SCRIPT_PREFIX}${basename}`);

    await act(async () => {
      await mockOpenHandler?.(
        { resource: currentFileUri, options: { selection } },
        mockEditor ?? undefined,
      );
    });

    expect(setScriptOverride).not.toHaveBeenCalled();
    expect(mockEditor?.setPosition).toHaveBeenCalledWith({
      lineNumber: selection.startLineNumber,
      column: selection.startColumn,
    });
    expect(mockEditor?.revealPositionInCenter).toHaveBeenCalled();
  });

  it("Given an unknown model When the open handler runs Then the handler returns the current editor", async () => {
    await act(async () => {
      renderEditor();
    });

    const unknownUri = monacoApi.Uri.parse("file:///unknown/model.ts");
    const result = await mockOpenHandler?.(
      { resource: unknownUri, options: {} },
      mockEditor ?? undefined,
    );

    expect(result).toBe(mockEditor);
  });

  it("Given a preexisting model with stale code When the script loads Then the model is updated", async () => {
    const staleCode = BasicBuilder.string();
    const freshCode = BasicBuilder.string();
    const basename = `${BasicBuilder.string()}.ts`;
    const uri = monacoApi.Uri.parse(`file://${DEFAULT_STUDIO_SCRIPT_PREFIX}${basename}`);
    monacoApi.editor.createModel(staleCode, "typescript", uri);

    await act(async () => {
      renderEditor({ script: buildScript({ filePath: basename, code: freshCode }) });
    });

    const model = monacoApi.editor.getModel(uri);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(model?.setValue).toHaveBeenCalledWith(freshCode);
  });

  it("Given no script is provided When rendering Then nothing is rendered", () => {
    const { container } = render(
      <Editor
        autoFormatOnSave={false}
        script={undefined}
        setScriptCode={jest.fn()}
        save={jest.fn()}
        setScriptOverride={jest.fn()}
        rosLib={BasicBuilder.string()}
        typesLib={BasicBuilder.string()}
      />,
    );

    expect(container.childElementCount).toBe(0);
  });

  it("Given a formatting failure When the provider runs Then it returns an empty edit set", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const getPrettifiedCode = jest.requireMock(
      "@lichtblick/suite-base/panels/UserScriptEditor/getPrettifiedCode",
    );
    getPrettifiedCode.mockRejectedValueOnce(new Error("formatting failure"));

    await act(async () => {
      renderEditor();
    });

    const provider = (monacoApi.languages.registerDocumentFormattingEditProvider as jest.Mock).mock
      .calls[0][1];
    const model = monacoApi.editor.createModel(
      "code",
      "typescript",
      monacoApi.Uri.parse("file:///a.ts"),
    );
    try {
      const edits = await provider.provideDocumentFormattingEdits(model);
      expect(edits).toEqual([]);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("Given a resize without width When the handler runs Then layout is not called", async () => {
    await act(async () => {
      renderEditor();
    });

    resizeDetectorOptions?.onResize?.({ width: undefined, height: 100 });
    expect(mockEditor?.layout).not.toHaveBeenCalled();
  });

  it("Given the editor receives source changes When the onChange handler fires Then the latest setter is called with new code", async () => {
    const setScriptCode = jest.fn();

    await act(async () => {
      renderEditor({ setScriptCode });
    });

    expect(mockOnChange).toBeDefined();

    const updatedCode = BasicBuilder.string();
    act(() => {
      mockOnChange?.(updatedCode);
    });

    expect(setScriptCode).toHaveBeenCalledWith(updatedCode);
  });
});
