// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

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

import { useTheme } from "@mui/material";
import { typescript } from "monaco-editor";
// @ts-expect-error ICodeEditorService does not have type information in the monaco-editor package
import { ICodeEditorService } from "monaco-editor/esm/vs/editor/browser/services/codeEditorService";
import * as monacoApi from "monaco-editor/esm/vs/editor/editor.api";
// @ts-expect-error StandaloneService does not have type information in the monaco-editor package
import { StandaloneServices } from "monaco-editor/esm/vs/editor/standalone/browser/standaloneServices";
import * as path from "path";
import React, { Suspense, ReactElement, useCallback, useEffect, useRef } from "react";
import MonacoEditor, { EditorDidMount, EditorWillMount } from "react-monaco-editor";
import { ResizePayload, useResizeDetector } from "react-resize-detector";
import { useLatest } from "react-use";
import { ModuleResolutionKind } from "typescript";

import ErrorBoundary from "@lichtblick/suite-base/components/ErrorBoundary";
import getPrettifiedCode from "@lichtblick/suite-base/panels/UserScriptEditor/getPrettifiedCode";
import { Script } from "@lichtblick/suite-base/panels/UserScriptEditor/script";
import { getUserScriptProjectConfig } from "@lichtblick/suite-base/players/UserScriptPlayer/transformerWorker/typescript/projectConfig";
import inScreenshotTests from "@lichtblick/suite-base/stories/inScreenshotTests";
import { DEFAULT_STUDIO_SCRIPT_PREFIX } from "@lichtblick/suite-base/util/constants";
import { mightActuallyBePartial } from "@lichtblick/suite-base/util/mightActuallyBePartial";

import { themes } from "./theme";

const codeEditorService = StandaloneServices.get(ICodeEditorService);

type CodeEditor = monacoApi.editor.ICodeEditor;

type Props = {
  script?: Script;
  setScriptCode: (code: string) => void;
  autoFormatOnSave: boolean;
  rosLib: string;
  typesLib: string;

  save: (code: string) => void;
  setScriptOverride: (script: Script) => void;
};

// Taken from:
// https://github.com/microsoft/vscode/blob/master/src/vs/editor/standalone/browser/standaloneCodeServiceImpl.ts
const gotoSelection = (editor: monacoApi.editor.IEditor, selection?: monacoApi.IRange) => {
  if (selection) {
    const maybeSelection = mightActuallyBePartial(selection);
    if (maybeSelection.endLineNumber != undefined && maybeSelection.endColumn != undefined) {
      // These fields indicate a range was selected, set the range and reveal it.
      editor.setSelection(selection);
      editor.revealRangeInCenter(
        selection,
        1,
        /* Immediate */
      );
    } else {
      // Otherwise it's just a position
      const pos = {
        lineNumber: selection.startLineNumber,
        column: selection.startColumn,
      };
      editor.setPosition(pos);
      editor.revealPositionInCenter(
        pos,
        1,
        /* Immediate */
      );
    }
  }
};

const projectConfig = getUserScriptProjectConfig();
const Editor = ({
  autoFormatOnSave,
  script,
  setScriptCode,
  save,
  setScriptOverride,
  rosLib,
  typesLib,
}: Props): ReactElement | ReactNull => {
  const editorRef = React.useRef<CodeEditor>(ReactNull);
  const autoFormatOnSaveRef = React.useRef(autoFormatOnSave);
  autoFormatOnSaveRef.current = autoFormatOnSave;

  const editorTheme = useTheme().palette.mode === "dark" ? "vs-studio-dark" : "vs-studio-light";

  React.useEffect(() => {
    const disposable = typescript.typescriptDefaults.addExtraLib(
      rosLib,
      `file:///node_modules/@types/${projectConfig.rosLib.fileName}`,
    );
    return () => {
      disposable.dispose();
    };
  }, [rosLib]);

  React.useEffect(() => {
    const filePath = monacoApi.Uri.parse(`file://${DEFAULT_STUDIO_SCRIPT_PREFIX}generatedTypes.ts`);
    const model =
      monacoApi.editor.getModel(filePath) ??
      monacoApi.editor.createModel(typesLib, "typescript", filePath);

    model.setValue(typesLib);
    model.updateOptions({ tabSize: 2 });
  }, [typesLib]);

  /*
  In order to support go-to across files we register an "open handler" for the code editor service.
  Our implementation looks across all of our models to find the one requested and then queues that as
  an override along with the requested selection (containing line # etc). When we're told to load
  this override script we'll end up loading the model in the useEffect below, and then using this
  selection to move to the correct line.
  */
  useEffect(() => {
    const disposable = codeEditorService.registerCodeEditorOpenHandler(
      async (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        input: any,
        // eslint-disable-next-line no-restricted-syntax
        editor: monacoApi.editor.ICodeEditor | null,
        // eslint-disable-next-line no-restricted-syntax
      ): Promise<monacoApi.editor.ICodeEditor | null> => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const requestedModel = monacoApi.editor.getModel(input.resource);
        if (!requestedModel) {
          return editor;
        }

        // If we are jumping to a definition within the user node, don't push
        // to script override.
        if (
          editor &&
          script &&
          requestedModel.uri.path ===
            `${DEFAULT_STUDIO_SCRIPT_PREFIX}${path.basename(script.filePath)}`
        ) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          gotoSelection(editor, input.options.selection);
          // eslint-disable-next-line no-restricted-syntax
          return null;
        }

        setScriptOverride({
          filePath: requestedModel.uri.path,
          code: requestedModel.getValue(),
          readOnly: true,
          selection: input.options?.selection,
        });
        return editor;
      },
    );
    return () => disposable.dispose();
  }, [script, setScriptOverride]);

  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !script) {
      return;
    }

    // For nodes, the name becomes the filePath.
    // For the editor to resolve relative imports of the utilities (i.e. ./types), we need the
    // user's code to be in a file next to the utility files. For this we grab the basename
    // of the user's entered node name to remove any path-like sections.
    const basename = path.basename(script.filePath);
    const filePath = monacoApi.Uri.parse(`file://${DEFAULT_STUDIO_SCRIPT_PREFIX}${basename}`);
    const model =
      monacoApi.editor.getModel(filePath) ??
      monacoApi.editor.createModel(script.code, "typescript", filePath);

    // Update the model's code if it was updated outside the Editor.
    // Without this, monaco can continue to show old code if the userScripts are changed outside of the Editor
    if (model.getValue() !== script.code) {
      model.setValue(script.code);
    }

    editor.setModel(model);
    gotoSelection(editor, script.selection);
  }, [script]);

  const options = React.useMemo<monacoApi.editor.IStandaloneEditorConstructionOptions>(() => {
    return {
      wordWrap: "on",
      minimap: {
        enabled: false,
      },
      readOnly: script?.readOnly,
    };
  }, [script]);

  const willMount = React.useCallback<EditorWillMount>(
    (monaco) => {
      if (!script) {
        return;
      }

      for (const theme of themes) {
        monaco.editor.defineTheme(theme.name, theme.theme);
      }

      // Set eager model sync to enable intellisense between the user code and utility files
      typescript.typescriptDefaults.setEagerModelSync(true);
      typescript.javascriptDefaults.setEagerModelSync(true);

      monaco.languages.registerDocumentFormattingEditProvider("typescript", {
        provideDocumentFormattingEdits: async (model) => {
          try {
            return [
              {
                range: model.getFullModelRange(),
                text: await getPrettifiedCode(model.getValue()),
              },
            ];
          } catch (err: unknown) {
            console.error(err);
            return [];
          }
        },
      });

      // Disable validation in screenshots to avoid flaky tests
      if (inScreenshotTests()) {
        typescript.typescriptDefaults.setDiagnosticsOptions({
          noSyntaxValidation: true,
          noSemanticValidation: true,
        });
      }

      // Load declarations and additional utility files from project config

      // This ensures the type defs we enforce in
      // the 'compile' step match that of monaco. Adding the 'lib'
      // this way (instead of specifying it in the compiler options)
      // is a hack to overwrite the default type defs since the
      // typescript language service does not expose such a method.
      projectConfig.declarations.forEach((lib) => {
        if (lib.fileName.startsWith("@foxglove/schemas")) {
          typescript.typescriptDefaults.addExtraLib(
            lib.sourceCode,
            `file:///node_modules/${lib.fileName}`,
          );
        } else {
          typescript.typescriptDefaults.addExtraLib(
            lib.sourceCode,
            `file:///node_modules/@types/${lib.fileName}`,
          );
        }
      });
      typescript.typescriptDefaults.setCompilerOptions({
        ...typescript.typescriptDefaults.getCompilerOptions(),
        // This is needed for @foxglove/schemas to resolve correctly in the editor.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        moduleResolution: ModuleResolutionKind.NodeNext as any,
      });
      projectConfig.utilityFiles.forEach((sourceFile) => {
        const filePath = monacoApi.Uri.parse(`file://${sourceFile.filePath}`);
        const model =
          monaco.editor.getModel(filePath) ??
          monaco.editor.createModel(sourceFile.sourceCode, "typescript", filePath);
        model.updateOptions({ tabSize: 2 });
      });

      // For nodes, the name becomes the filePath.
      // For the editor to resolve relative imports of the utilities (i.e. ./types), we need the
      // user's code to be in a file next to the utility files. For this we grab the basename
      // of the user's entered node name to remove any path-like sections.
      const basename = path.basename(script.filePath);
      const filePath = monacoApi.Uri.parse(`file://${DEFAULT_STUDIO_SCRIPT_PREFIX}${basename}`);
      const model =
        monaco.editor.getModel(filePath) ??
        monaco.editor.createModel(script.code, "typescript", filePath);

      // Because anything else is blasphemy.
      model.updateOptions({ tabSize: 2 });

      return {
        model,
      };
    },
    [script],
  );

  const saveCode = React.useCallback(async () => {
    const model = editorRef.current?.getModel();
    if (model && script && !script.readOnly) {
      // We have to use a ref for autoFormatOnSaveRef because of how monaco scopes the action callbacks
      if (autoFormatOnSaveRef.current) {
        await editorRef.current?.getAction("editor.action.formatDocument")?.run();
      }
      save(model.getValue());
    }
  }, [save, script]);

  const saveCodeRef = useRef(saveCode);
  saveCodeRef.current = saveCode;
  const didMount = React.useCallback<EditorDidMount>((editor) => {
    editorRef.current = editor;
    editor.addAction({
      id: "ctrl-s",
      label: "Save current node",
      keybindings: [monacoApi.KeyMod.CtrlCmd | monacoApi.KeyCode.KeyS],

      // Because this didMount function only runs once, we need to store the saveCode function in a
      // ref so the command can always access the latest version.
      run: async () => {
        await saveCodeRef.current();
      },
    });
  }, []);

  // Refer to setScriptCode by reference so that the onChange callback isn't invalidated
  // on every edit.
  const latestSetScriptCode = useLatest(setScriptCode);
  const onChange = useCallback(
    (srcCode: string) => {
      latestSetScriptCode.current(srcCode);
    },
    [latestSetScriptCode],
  );

  const onResize = useCallback(({ width, height }: ResizePayload) => {
    if (width == undefined) {
      return;
    }
    editorRef.current?.layout({ width, height });
  }, []);

  // monaco editor builtin auto layout uses an interval to adjust size to the parent component
  // instead we use a resize observer and tell the editor to update the layout
  // Use a debounce and 0 refresh rate to avoid triggering a resize observation while handling
  // an existing resize observation.
  // https://github.com/maslianok/react-resize-detector/issues/45
  const { ref: sizeRef } = useResizeDetector({
    refreshRate: 0,
    refreshMode: "debounce",
    onResize,
  });

  if (!script) {
    // No script to load
    return ReactNull;
  }

  // The ErrorBoundary is required to properly capture runtime errors from Monaco Editor.
  // Without it, TypeScript or Monaco-related errors (e.g., type mismatches or input availability issues)
  // may not appear in the "Problems" tab. Do not remove this wrapper.
  return (
    <div ref={sizeRef} style={{ width: "100%", height: "100%" }}>
      <ErrorBoundary>
        <Suspense fallback={<p>Loading user script editor</p>}>
          <MonacoEditor
            language="typescript"
            theme={editorTheme}
            editorWillMount={willMount}
            editorDidMount={didMount}
            options={options}
            onChange={onChange}
          />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

export default Editor;
