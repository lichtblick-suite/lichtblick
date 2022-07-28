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

import ts from "typescript/lib/typescript";

import { filterMap } from "@foxglove/den/collection";
import { formatInterfaceName } from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/generateRosLib";
import {
  constructDatatypes,
  findDefaultExportFunction,
  DatatypeExtractionError,
  findReturnType,
} from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/typescript/ast";
import { getNodeProjectConfig } from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/typescript/projectConfig";
import {
  baseCompilerOptions,
  transformDiagnosticToMarkerData,
} from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/utils";
import {
  DiagnosticSeverity,
  Sources,
  ErrorCodes,
  NodeData,
  Diagnostic,
  NodeDataTransformer,
} from "@foxglove/studio-base/players/UserNodePlayer/types";
import { Topic } from "@foxglove/studio-base/players/types";
import { DEFAULT_STUDIO_NODE_PREFIX } from "@foxglove/studio-base/util/globalConstants";

import { TransformArgs } from "./types";
import generatedTypesLibSrc from "./typescript/userUtils/generatedTypes.ts?raw";

export const hasTransformerErrors = (nodeData: NodeData): boolean =>
  nodeData.diagnostics.some(({ severity }) => severity === DiagnosticSeverity.Error);

export const getInputTopics = (nodeData: NodeData): NodeData => {
  const { sourceFile, typeChecker } = nodeData;
  if (!sourceFile || !typeChecker) {
    const error = {
      severity: DiagnosticSeverity.Error,
      message:
        "Either the 'sourceFile' or 'typeChecker' is absent. There is a problem with the `compile` step.",
      source: Sources.InputTopicsChecker,
      code: ErrorCodes.InputTopicsChecker.BAD_INPUTS_TYPE,
    };

    return {
      ...nodeData,
      diagnostics: [...nodeData.diagnostics, error],
    };
  }

  const symbol = typeChecker.getSymbolAtLocation(sourceFile);
  if (!symbol) {
    const error: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      message: "Must export an input topics array. E.g. 'export const inputs = ['/some_topics']'",
      source: Sources.InputTopicsChecker,
      code: ErrorCodes.InputTopicsChecker.NO_INPUTS_EXPORT,
    };
    return {
      ...nodeData,
      diagnostics: [...nodeData.diagnostics, error],
    };
  }

  const inputsExport = typeChecker
    .getExportsOfModule(symbol)
    .find((node) => node.escapedName === "inputs");
  if (!inputsExport) {
    const error: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      message: "Must export a non-empty inputs array.",
      source: Sources.InputTopicsChecker,
      code: ErrorCodes.InputTopicsChecker.EMPTY_INPUTS_EXPORT,
    };
    return {
      ...nodeData,
      diagnostics: [...nodeData.diagnostics, error],
    };
  }

  const decl = inputsExport.declarations?.[0];
  if (!decl || !ts.isVariableDeclaration(decl)) {
    const error: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      message: "inputs export must be an array variable.",
      source: Sources.InputTopicsChecker,
      code: ErrorCodes.InputTopicsChecker.BAD_INPUTS_TYPE,
    };
    return {
      ...nodeData,
      diagnostics: [...nodeData.diagnostics, error],
    };
  }

  if (!decl.initializer || !ts.isArrayLiteralExpression(decl.initializer)) {
    const error: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      message: "inputs export must be an array variable.",
      source: Sources.InputTopicsChecker,
      code: ErrorCodes.InputTopicsChecker.BAD_INPUTS_TYPE,
    };
    return {
      ...nodeData,
      diagnostics: [...nodeData.diagnostics, error],
    };
  }

  const inputTopicElements = decl.initializer.elements;
  if (inputTopicElements.some(({ kind }) => kind !== ts.SyntaxKind.StringLiteral)) {
    const error: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      message:
        "The exported 'inputs' variable must be an array of string literals. E.g. 'export const inputs = ['/some_topics']'",
      source: Sources.InputTopicsChecker,
      code: ErrorCodes.InputTopicsChecker.BAD_INPUTS_TYPE,
    };
    return {
      ...nodeData,
      diagnostics: [...nodeData.diagnostics, error],
    };
  }

  const inputTopics = filterMap(inputTopicElements, (expression) => {
    if (!ts.isStringLiteral(expression)) {
      return undefined;
    }
    return expression.text;
  });

  if (inputTopics.length === 0) {
    const error: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      message:
        'Must include non-empty inputs array, e.g. export const inputs = ["/some_input_topic"];',
      source: Sources.InputTopicsChecker,
      code: ErrorCodes.InputTopicsChecker.EMPTY_INPUTS_EXPORT,
    };

    return {
      ...nodeData,
      diagnostics: [...nodeData.diagnostics, error],
    };
  }

  return {
    ...nodeData,
    inputTopics,
  };
};

export const getOutputTopic = (nodeData: NodeData): NodeData => {
  const matches = /^\s*export\s+const\s+output\s*=\s*("([^"]+)"|'([^']+)')/gm.exec(
    nodeData.sourceCode,
  );
  // Pick either the first matching group or the second, which corresponds
  // to single quotes or double quotes respectively.
  const outputTopic = matches?.[2] ?? matches?.[3];

  if (outputTopic == undefined) {
    const error = {
      severity: DiagnosticSeverity.Error,
      message: `Must include an output, e.g. export const output = "${DEFAULT_STUDIO_NODE_PREFIX}your_output_topic";`,
      source: Sources.OutputTopicChecker,
      code: ErrorCodes.OutputTopicChecker.NO_OUTPUTS,
    };

    return {
      ...nodeData,
      diagnostics: [...nodeData.diagnostics, error],
    };
  }

  return {
    ...nodeData,
    outputTopic,
  };
};

export const validateInputTopics = (nodeData: NodeData, topics: Topic[]): NodeData => {
  const { inputTopics } = nodeData;
  const activeTopics = topics.map(({ name }) => name);
  const diagnostics = [];
  for (const inputTopic of inputTopics) {
    if (!activeTopics.includes(inputTopic)) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        message: `Input "${inputTopic}" is not yet available`,
        source: Sources.InputTopicsChecker,
        code: ErrorCodes.InputTopicsChecker.NO_TOPIC_AVAIL,
      });
    }
  }

  return {
    ...nodeData,
    diagnostics: [...nodeData.diagnostics, ...diagnostics],
  };
};

// The compile step is currently used for generating syntactic/semantic errors. In the future, it
// will be leveraged to:
// - Generate the AST
// - Handle external libraries
export const compile = (nodeData: NodeData): NodeData => {
  const { sourceCode, rosLib, typesLib } = nodeData;

  const options: ts.CompilerOptions = baseCompilerOptions;
  const nodeFileName = "/studio_script/index.ts";
  const projectConfig = getNodeProjectConfig();
  const projectCode = new Map<string, string>();

  const sourceCodeMap = new Map<string, string>();
  sourceCodeMap.set(nodeFileName, sourceCode);
  sourceCodeMap.set(projectConfig.rosLib.filePath, rosLib);
  sourceCodeMap.set("/studio_script/generatedTypes.ts", typesLib ? typesLib : generatedTypesLibSrc);

  projectConfig.utilityFiles.forEach((file) => sourceCodeMap.set(file.filePath, file.sourceCode));
  projectConfig.declarations.forEach((lib) => sourceCodeMap.set(lib.filePath, lib.sourceCode));

  let transpiledCode: string = "";
  let codeEmitted: boolean = false;

  // The compiler host is basically the file system API Typescript is funneled
  // through. All we do is tell Typescript where it can locate files and how to
  // create source files for the time being.

  // Reference:
  // Using the compiler api: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
  // CompilerHost: https://github.com/microsoft/TypeScript/blob/v3.5.3/lib/typescript.d.ts#L2752
  // Architectual Overview: https://github.com/Microsoft/TypeScript/wiki/Architectural-Overview#overview-of-the-compilation-process

  const host: ts.CompilerHost = {
    getDefaultLibFileName: () => projectConfig.defaultLibFileName,
    getCurrentDirectory: () => "",
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => false,
    readFile: () => {
      return undefined;
    },
    fileExists: (fileName) => {
      for (const [key] of sourceCodeMap.entries()) {
        if (fileName === key || fileName.endsWith(key)) {
          return true;
        }
      }
      return false;
    },
    writeFile: (name: string, data: string) => {
      codeEmitted = true;
      if (name === "/studio_script/index.js") {
        transpiledCode = data;
      } else {
        // It's one of our utility files
        projectCode.set(name, data);
      }
    },
    getNewLine: () => "\n",
    getSourceFile: (fileName) => {
      let code = "";
      for (const [key, value] of sourceCodeMap.entries()) {
        if (fileName === key || fileName.endsWith(key)) {
          code = value;
          break;
        }
      }
      return ts.createSourceFile(fileName, code, baseCompilerOptions.target, true);
    },
  };

  const program = ts.createProgram([nodeFileName], options, host);
  program.emit();
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!codeEmitted) {
    const error = {
      severity: DiagnosticSeverity.Error,
      message: "Program code was not emitted.",
      source: Sources.InputTopicsChecker,
      code: ErrorCodes.InputTopicsChecker.BAD_INPUTS_TYPE,
    };

    return {
      ...nodeData,
      diagnostics: [...nodeData.diagnostics, error],
    };
  }

  const diagnostics = [...program.getSemanticDiagnostics(), ...program.getSyntacticDiagnostics()];

  const newDiagnostics = diagnostics.map(transformDiagnosticToMarkerData);

  const sourceFile = program.getSourceFile(nodeFileName);
  const typeChecker = program.getTypeChecker();

  return {
    ...nodeData,
    sourceFile,
    typeChecker,
    transpiledCode,
    projectCode,
    diagnostics: [...nodeData.diagnostics, ...newDiagnostics],
  };
};

// Currently we only look types matching the exact name "GlobalVariables". In the future,
// we should check the type of the 2nd arg passed to the publisher function in
// case users have renamed the GlobalVariables type.
export const extractGlobalVariables = (nodeData: NodeData): NodeData => {
  // Do not attempt to run if there were any compile time errors.
  if (hasTransformerErrors(nodeData)) {
    return nodeData;
  }

  const { sourceFile } = nodeData;
  if (!sourceFile) {
    throw new Error("'sourceFile' is absent'. There is a problem with the `compile` step.");
  }

  const globalVariablesMembers = sourceFile.forEachChild((node) => {
    if (
      ts.isTypeAliasDeclaration(node) &&
      ts.isTypeLiteralNode(node.type) &&
      node.name.text === "GlobalVariables"
    ) {
      return node.type.members;
    } else if (ts.isInterfaceDeclaration(node) && node.name.text === "GlobalVariables") {
      return node.members;
    }
    return undefined;
  });

  const globalVariables = filterMap(globalVariablesMembers ?? [], (member) => {
    if (!member.name) {
      return undefined;
    }
    if (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)) {
      return member.name.text;
    }
    return undefined;
  });

  return {
    ...nodeData,
    globalVariables,
  };
};

export const extractDatatypes = (nodeData: NodeData): NodeData => {
  // Do not attempt to run if there were any compile time errors.
  if (hasTransformerErrors(nodeData)) {
    return nodeData;
  }

  const { sourceFile, typeChecker, name, datatypes: sourceDatatypes } = nodeData;
  if (!sourceFile || !typeChecker) {
    throw new Error(
      "Either the 'sourceFile' or 'typeChecker' is absent'. There is a problem with the `compile` step.",
    );
  }

  // Keys each message definition like { 'std_msg__ColorRGBA': 'std_msg/ColorRGBA' }
  const messageDefinitionMap: Record<string, string> = {};
  for (const datatype of sourceDatatypes.keys()) {
    messageDefinitionMap[formatInterfaceName(datatype)] = datatype;
  }

  try {
    const exportNode = findDefaultExportFunction(sourceFile, typeChecker);
    if (!exportNode) {
      throw new Error("Your node must default export a function");
    }

    const typeNode = findReturnType(typeChecker, exportNode);

    const { outputDatatype, datatypes } = constructDatatypes(
      typeChecker,
      typeNode,
      name,
      messageDefinitionMap,
      sourceDatatypes,
    );
    return { ...nodeData, datatypes, outputDatatype };
  } catch (error) {
    if (error instanceof DatatypeExtractionError) {
      return { ...nodeData, diagnostics: [...nodeData.diagnostics, error.diagnostic] };
    }

    throw error;
  }
};

/*
TODO:
  - what happens when the `register` portion of the node pipeline fails to instantiate the code? can we get the stack trace?
*/
export const compose = (...transformers: NodeDataTransformer[]): NodeDataTransformer => {
  return (nodeData: NodeData, topics: Topic[]) => {
    let newNodeData = nodeData;
    for (const transformer of transformers) {
      newNodeData = transformer(newNodeData, topics);
    }
    return newNodeData;
  };
};

/*

  TRANSFORM

  Defines the pipeline with which user nodes are processed. Each
  'NodeDataTransformer' is a pure function that receives NodeData and returns
  NodeData. In this way, each transformer has the power to inspect previous
  diagnostics, compiled source code, etc. and to abort the pipeline if there
  is a fatal error, or continue to pass along information further downstream
  when errors are not fatal.

*/
const transform = (args: TransformArgs): NodeData => {
  const { name, sourceCode, topics, rosLib, typesLib, datatypes } = args;

  const transformer = compose(
    getOutputTopic,
    compile,
    getInputTopics,
    validateInputTopics,
    extractDatatypes,
    extractGlobalVariables,
  );

  const result = transformer(
    {
      name,
      sourceCode,
      rosLib,
      typesLib,
      transpiledCode: "",
      projectCode: undefined,
      inputTopics: [],
      outputTopic: "",
      outputDatatype: "",
      diagnostics: [],
      globalVariables: [],
      datatypes,
      sourceFile: undefined,
      typeChecker: undefined,
    },
    topics,
  );
  return { ...result, sourceFile: undefined, typeChecker: undefined };
};

export default transform;
