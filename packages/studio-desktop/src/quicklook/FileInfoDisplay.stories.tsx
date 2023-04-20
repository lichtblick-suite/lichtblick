// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";

import FileInfoDisplay from "./FileInfoDisplay";
import StorybookDecorator from "./StorybookDecorator";

export default {
  title: "quicklook/FileInfoDisplay",
  component: FileInfoDisplay,
  decorators: [StorybookDecorator],
  parameters: {
    chromatic: {
      viewports: [320, 500],
    },
  },
};

export const Bag: StoryObj = {
  render: () => {
    return <FileInfoDisplay fileStats={{ name: "name.bag", size: 0 }} />;
  },
};

export const Mcap: StoryObj = {
  render: () => {
    return <FileInfoDisplay fileStats={{ name: "name.mcap", size: 0 }} />;
  },
};

export const LongName: StoryObj = {
  render: () => {
    return (
      <FileInfoDisplay
        fileStats={{
          name: "a_really_long_file_name_that_wraps_a_really_long_file_name_that_wraps_a_really_long_file_name_that_wraps.mcap",
          size: 0,
        }}
      />
    );
  },
};

export const ErrorStory: StoryObj = {
  render: function Story() {
    return (
      <FileInfoDisplay fileStats={{ name: "name", size: 0 }} error={new Error("Example error")} />
    );
  },

  name: "Error",
};

export const Details: StoryObj = {
  render: () => {
    return (
      <FileInfoDisplay
        fileStats={{ name: "name.mcap", size: 0 }}
        fileInfo={{
          fileType: "file type",
          numChunks: 1,
          numAttachments: 2,
          totalMessages: 3n,
          startTime: { sec: 0, nsec: 1 },
          endTime: { sec: 1, nsec: 2 },
          topics: [
            { topic: "foo", schemaName: "Foo", numMessages: 100n, numConnections: 1 },
            { topic: "bar", schemaName: "Bar", numMessages: 1_000_000n, numConnections: 2 },
            { topic: "baz", schemaName: "Baz", numMessages: undefined, numConnections: 0 },
          ],
          compressionTypes: new Set(["zstd"]),
        }}
      />
    );
  },
};
