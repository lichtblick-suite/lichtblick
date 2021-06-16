// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Stack, useTheme } from "@fluentui/react";

export default {
  title: "Theme",
};

function ColorStory({ colors }: { colors: [string, string][] }) {
  const theme = useTheme();

  return (
    <Stack
      wrap
      tokens={{ childrenGap: theme.spacing.s1 }}
      style={{ padding: theme.spacing.m, overflowX: "auto" }}
    >
      {colors.map(([name, color]) => (
        <Stack
          key={name}
          horizontal
          verticalAlign="center"
          tokens={{ childrenGap: theme.spacing.s1 }}
        >
          <div
            key={name}
            style={{ backgroundColor: color, width: theme.spacing.l2, height: theme.spacing.l2 }}
          />
          <div>{name}</div>
        </Stack>
      ))}
    </Stack>
  );
}

export function Palette(): JSX.Element {
  const theme = useTheme();
  return <ColorStory colors={Object.entries(theme.palette)} />;
}

export function SemanticColors(): JSX.Element {
  const theme = useTheme();
  return (
    <ColorStory
      colors={Object.entries(theme.semanticColors).sort(([name1], [name2]) =>
        name1.localeCompare(name2),
      )}
    />
  );
}
