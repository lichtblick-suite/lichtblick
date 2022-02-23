// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useTheme as useFluentTheme } from "@fluentui/react";
import { Box, Stack } from "@mui/material";

export default {
  title: "Theme",
};

function ColorStory({ colors }: { colors: [string, string][] }) {
  return (
    <Stack flexWrap="wrap" padding={2} overflow="auto">
      {colors.map(([name, color]) => (
        <Stack key={name} direction="row" alignItems="center" spacing={1} padding={0.5}>
          <Box key={name} bgcolor={color} width={32} height={32} />
          <div>{name}</div>
        </Stack>
      ))}
    </Stack>
  );
}

export function Palette(): JSX.Element {
  const theme = useFluentTheme();
  return <ColorStory colors={Object.entries(theme.palette)} />;
}

export function SemanticColors(): JSX.Element {
  const theme = useFluentTheme();
  return (
    <ColorStory
      colors={Object.entries(theme.semanticColors).sort(([name1], [name2]) =>
        name1.localeCompare(name2),
      )}
    />
  );
}
