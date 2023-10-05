// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/* eslint-disable filenames/match-exported */

import * as monacoApi from "monaco-editor/esm/vs/editor/editor.api";

const theme: monacoApi.editor.IStandaloneThemeData = {
  base: "vs",
  inherit: true,
  rules: [
    {
      foreground: "eefff8",
      background: "2f8963",
      token: "markup.inserted.diff",
    },
    {
      foreground: "eefff8",
      background: "2f8963",
      token: "meta.diff.header.to-file",
    },
    {
      foreground: "fff3ee",
      background: "c86a44",
      token: "markup.deleted.diff",
    },
    {
      foreground: "fff3ee",
      background: "c86a44",
      token: "meta.diff.header.from-file",
    },
    {
      foreground: "008000",
      token: "comment",
    },
    {
      foreground: "000000",
      token: "variable",
    },
    {
      foreground: "0000ff",
      token: "keyword",
    },
    {
      foreground: "a31515",
      token: "constant.numeric",
    },
    {
      foreground: "000000",
      token: "constant",
    },
    {
      foreground: "000000",
      token: "constant.language",
    },
    {
      foreground: "0000ff",
      token: "constant.language.boolean",
    },
    {
      foreground: "a31515",
      token: "string",
    },
    {
      foreground: "26b31a",
      token: "constant.character.escape",
    },
    {
      foreground: "26b31a",
      token: "string source",
    },
    {
      foreground: "0000ff",
      token: "meta.preprocessor",
    },
    {
      foreground: "0000ff",
      token: "keyword.control.import",
    },
    {
      foreground: "000000",
      token: "entity.name.function",
    },
    {
      foreground: "000000",
      token: "keyword.other.name-of-parameter.objc",
    },
    {
      foreground: "000000",
      token: "entity.name.type",
    },
    {
      foreground: "0000ff",
      token: "storage.type",
    },
    {
      foreground: "0000ff",
      token: "storage.modifier",
    },
    {
      foreground: "70727e",
      token: "storage.type.method",
    },
    {
      foreground: "000000",
      token: "support.function",
    },
    {
      foreground: "000000",
      token: "support.class",
    },
    {
      foreground: "000000",
      token: "support.type",
    },
    {
      foreground: "000000",
      token: "support.constant",
    },
    {
      foreground: "000000",
      token: "support.variable",
    },
    {
      foreground: "687687",
      token: "keyword.operator.js",
    },
    {
      background: "e1a09f",
      token: "invalid",
    },
    {
      background: "ffd0d0",
      token: "invalid.deprecated.trailing-whitespace",
    },
    {
      background: "427ff530",
      token: "text source",
    },
    {
      background: "427ff530",
      token: "string.unquoted",
    },
    {
      foreground: "68685b",
      token: "meta.xml-processing",
    },
    {
      foreground: "68685b",
      token: "declaration.xml-processing",
    },
    {
      foreground: "a31515",
      token: "meta.doctype",
    },
    {
      foreground: "a31515",
      token: "declaration.doctype",
    },
    {
      foreground: "0000ff",
      token: "meta.tag",
    },
    {
      foreground: "0000ff",
      token: "declaration.tag",
    },
    {
      foreground: "a31515",
      token: "entity.name.tag",
    },
    {
      foreground: "ff0000",
      token: "entity.other.attribute-name",
    },
    {
      foreground: "0000ff",
      token: "string.quoted.double.xml",
    },
    {
      foreground: "0000ff",
      token: "string.quoted.double.html",
    },
    {
      foreground: "0c07ff",
      token: "markup.heading",
    },
    {
      foreground: "000000",
      token: "markup.quote",
    },
    {
      foreground: "b90690",
      token: "markup.list",
    },
  ],
  colors: {
    "editor.foreground": "#000000",
    "editor.background": "#FFFFFF",
    "editor.selectionBackground": "#9DA7C3",
    "editor.lineHighlightBackground": "#00000012",
    "editorCursor.foreground": "#000000",
    "editorWhitespace.foreground": "#BFBFBF",
  },
};

export default theme;
