# `@fluentui/react` quick start guide

[Fluent UI](https://developer.microsoft.com/en-us/fluentui) is a React component library for building UIs. This guide is meant to provide some useful tips to help you be productive with Fluent UI while working on Studio.

Fluent UI is developed as a [monorepo](https://github.com/microsoft/fluentui) containing many sub-packages, but most functions and components are re-exported from the base `@fluentui/react` package.

## Sandbox

- CodePen: https://aka.ms/fluentpen
- CodeSandbox: https://aka.ms/fluentsandbox

## Components

A list of available components with examples can be found at: https://developer.microsoft.com/en-us/fluentui#/controls/web

Some components are exported from the library but are not visible on this page, such as `ContextualMenuItem`.

### Subcomponent Props

> 👁 Keep an eye out for this pattern:

Many Fluent UI components contain other subcomponents — for example, a `ContextualMenu` uses a `Callout`, and a `Button` may contain an `Icon`. Usually, **subcomponent props are passed to the parent component**:

```tsx
<ContextualMenu
  items={[]}

  // props for the nested Callout
  calloutProps={{ directionalHint: DirectionalHint.bottomCenter }}
/>

<Button
  // props for the nested Icon
  iconProps={{ iconName: "Add" }} />
```

Intellisense/autocomplete and the "header" documentation in .d.ts files is pretty good for these, so when in doubt, try _Go to Definition_.

## Theme

Our theme is configured in [theme/index.ts](../packages/studio-base/theme/index.ts) and provided to components via [ThemeProvider](../packages/studio-base/theme/ThemeProvider.tsx). It has a `palette` of colors as well as some "slots" for [semantic colors](https://docs.microsoft.com/en-us/javascript/api/theme/isemanticcolors?view=office-ui-fabric-react-latest) (such as `buttonBackground`) to customize certain components. You can also configure fonts, spacing, effects, and more in the theme object.

There's a Theme Designer tool at https://aka.ms/themedesigner. It has limited customization capabilities, but helps you get a feel for what theme colors will look like.

To consume the theme directly in a component, you can `useTheme()`.

### Customizing components

> 👁 Keep an eye out for this pattern:

Each component has a `styles` prop (`Foo`'s style prop is strongly typed as `IFooStyles`). The styles often also include a `subComponentStyles` property to customize nested component styles.

The `styles` prop can usually be an object **or a function** — for example `IStyleFunctionOrObject<ICheckboxStyleProps, ICheckboxStyles>`, in which case you can either pass in an `ICheckboxStyles` object directly or a function `(props: ICheckboxStyleProps) => ICheckboxStyles`. In the case of a checkbox, the "style props" input contains things like `disabled: boolean` and `checked: boolean`. The style props also contain the `theme`.

Anything you can customize in `styles` can also be configured [at the theme level](https://docs.microsoft.com/en-us/javascript/api/theme/componentstyles?view=office-ui-fabric-react-latest) as follows:

```ts
createTheme({
  ...
  components: {
    Button: {
      styles: {
        ...
      } as Partial<IButtonStyles>,
    },
  },
})
```

### Use with styled-components

The same theme is provided to styled-components (with strong typing from [styled-components.d.ts](../typings/styled-components.d.ts)) and merged into other props, so you can do something like this:

```ts
const Foo = styled.div<{ on: boolean }>`
  background-color: ${({ on, theme }) => (on ? theme.palette.themePrimary : "transparent")};
`;
```

## Icons

Prefer to add icons to a component via `iconProps.iconName`, for example: `<Button iconProps={{ iconName: "Add" }} />`.

We use Fluent UI's SVG icons (`@fluentui/react-icons-mdl2`) because they are MIT-licensed, unlike the icon fonts, and Webpack can automatically bundle the icons we need.

The list of icons can be found at: https://developer.microsoft.com/en-us/fluentui#/styles/web/icons or https://aka.ms/fluentui-icons. Note that some of these icons (usually the MS brand-specific icons) are not available as SVGs.

> 📝 Tip: you can navigate between the list of components and icons by scrolling to the top of the Fluent UI website and clicking either "Styles" or "Controls".

### Using a new icon

Since we only import the SVG icons we need, icons must be registered before they are used. This is done in the [ThemeProvider](../packages/studio-base/theme/ThemeProvider.tsx), and there is a corresponding type definition tracking the `RegisteredIconNames` at [fluentui.d.ts](../typings/fluentui.d.ts). The TypeScript compiler will prompt you to update both of these places before you can use a new icon.

### Custom SVG icons

You can make a custom SVG icon conform to the Fluent UI theme by using `createSvgIcon()`. See [RosIcon.tsx](../packages/studio-base/components/RosIcon.tsx) for an example.

```tsx
import { createSvgIcon } from "@fluentui/react-icons-mdl2";

export default createSvgIcon({
  displayName: "RosIcon",
  svg({ classes }) {
    return <RosSvg className={classes.svg} style={{ width: "auto" }} />;
  },
});
```

## Custom CSS

Fluent UI provides functions like `mergeStyles()` and `keyframes()` for custom CSS. For example:

```ts
const className = mergeStyles({
  borderColor: "white",
  ":hover": { backgroundColor: "#c51162" },
  "@media (min-width:600px)": {
    backgroundColor: "rgba(0, 0, 0, 0.87)",
  },
});
```

You can read more about these here: https://github.com/microsoft/fluentui/blob/master/packages/merge-styles/README.md
