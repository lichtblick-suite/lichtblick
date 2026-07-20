---
description: "Deep theme system knowledge: createMuiTheme factory, dark/light palette tokens, typography scale, ThemeProvider color-scheme application, and tss-react/mui styling conventions."
---

# Theme Skill

How colors, typography, and the overall visual design are managed via Material-UI (MUI) theming.

## Layout

```
packages/theme/src/
    ├── index.ts            (package entry, re-exports)
    ├── createMuiTheme.ts   (MUI theme factory)
    ├── palette.ts          (dark & light color definitions)
    ├── typography.ts       (font families & sizes)
    └── components/         (MUI component overrides)
```

## Core Files

| File | Role |
|------|------|
| `packages/theme/src/createMuiTheme.ts` | Factory that builds the full MUI theme |
| `packages/theme/src/palette.ts` | Dark and light palette color definitions |
| `packages/theme/src/typography.ts` | Font families (Inter, IBM Plex Mono) and scale |
| `packages/theme/src/index.ts` | Package entry, re-exports |

> Treat `palette.ts` / `typography.ts` as the source of truth for exact token values (hex codes,
> font sizes). Read them directly rather than hardcoding specific values elsewhere.

## Color Scheme

Lichtblick supports two schemes: **dark** (default) and **light**. Each is defined as a palette
object (`mode`, `primary`, `secondary`, `error`, `warning`, `info`, `success`, `background`,
`text`, …) in `palette.ts`.

### How a Color Scheme is Applied
1. User sets a preference (AppConfiguration `colorScheme` setting)
2. `ThemeProvider` reads the preference from context
3. `createMuiTheme(colorScheme)` is called with `"dark"` or `"light"`
4. MUI's `ThemeProvider` wraps the entire app with the resulting theme

```typescript
function createMuiTheme(colorScheme: "dark" | "light"): Theme {
  const palette = colorScheme === "dark" ? darkPalette : lightPalette;
  return createTheme({ palette, typography, components: { /* MUI overrides */ } });
}
```

## Typography

- **Inter** — primary UI font (variable weight)
- **IBM Plex Mono** — code/data display (timestamps, topic names, raw messages)

The scale (`h1`, `h2`, `body1`, `body2`, …) is defined in `typography.ts`.

## Styling Convention (tss-react/mui)

Components are styled with `tss-react/mui` — **not** `@emotion/styled`, MUI's `styled()`, `Box`, or
the `sx` prop. Styles live in `ComponentName.style.ts` files.

```typescript
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()((theme) => ({
  root: {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    fontFamily: theme.typography.fontFamily,
  },
  highlight: { color: theme.palette.primary.main },
}));
```

## Skills Reference
- For panel-level `colorScheme` delivery in `RenderState`: load `panel-extension-api` skill
