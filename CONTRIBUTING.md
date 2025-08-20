# Contributing Guidelines

Welcome, and thank you for your interest in contributing to Lichtblick! We value your contributions and want to make the contributing experience enjoyable and rewarding for you. Here’s how you can get started:

## :rocket: Getting Started

Please check our [README.md](README.md) and follow the installation steps.

#### Other useful commands

```sh
# To launch the storybook
$ yarn storybook
```

```sh
# Advanced usage: running webpack and electron on different computers (or VMs) on the same network
$ yarn desktop:serve --host 192.168.xxx.yyy # the address where electron can reach the webpack dev server
$ yarn dlx electron@22.1.0 .webpack # launch the version of electron for the current computer's platform
```

```sh
$ yarn run               # list available commands
$ yarn lint              # lint all files
$ yarn test              # run all tests
$ yarn test:watch        # run tests on changed files
$ yarn test:e2e:desktop  # run all e2e tests
```

# Branching Strategy - Git flow

When creating a new branch in this repository, please follow the naming guidelines below to ensure clarity and consistency:

- **feature/** → For developing new features or significant improvements.
  _Example: `feature/user-authentication`_

- **bugfix/** → For fixing non-critical bugs or issues found in existing features.
  _Example: `bugfix/fix-login-redirect`_

- **hotfix/** → For urgent, critical fixes that must be applied quickly (usually targeting the `main` branch).
  _Example: `hotfix/security-patch`_

- **release/** → For preparing production releases. These branches allow for final testing and adjustments before merging into `main`.
  _Example: `release/1.2.0`_

- **dependabot/** → Automatically created branches for dependency updates.

---

⚠️ **Deprecated branch types**:
`test`, `docs`, `wip`, and `cicd` are no longer part of the official branching strategy.
Please use the categories listed above instead.

## :label: Version increment

Semantic Versioning has been chosen as our standard method for version increments, which is widely adopted across various software projects. The version format is structured as follows:
`<major>.<minor>.<patch>[.<build number>]`.

- _Note: Currently, the version increment process is manual. Developers are required to update the version number in the package.json file manually. An automated pipeline for this task is in development and will be implemented to streamline this process in the future._

### Components

MAJOR: Increasing the major version usually breaks compatibility, allowing developers to remove the deprecated API or rework the existing ones. Users know about it and do not expect a smooth update.

MINOR: Version increment implies adding new functionality without breaking compatibility.

PATCH: Also known as bugfix version that includes fixing security vulnerabilities, etc.

BUILD NUMBER (Optional): Optionally, the build number can be additionally added.

### Examples

`1.20.11`

`1.20.11.403`

## :globe_with_meridians: Localization

At this time, first-class support for Lichtblick is provided in English only. Localization into other languages is available on a best-effort basis, with translations provided by community volunteers.

Translation support is implemented using [`react-i18next`](https://react.i18next.com).

### Add translations

- We value having _high-quality_ translations over having _all_ translations for a given component or view. Though every PR must have up-to-date English translations, updating other languages is completely optional.
- If you update an English translation and cannot provide updated non-English translations, delete the non-English versions in that PR. Optionally, open follow-up PRs to add accurate non-English translations.

### Add translations to the `i18n` directory

The [`i18n` directory](packages/suite-base/src/i18n) contains translated (localized) strings for all languages supported by Lichtblick.

Translated strings are organized into _namespaces_ — e.g. [`i18n/[language]/appSettings.ts`](packages/suite-base/src/i18n/en/appSettings.ts) contains translations for the app's Settings tab.

### Use `useTranslation()` and `t()` to access translated strings

1. Call the [<code>useTranslation(<i>namespace</i>)</code> hook](https://react.i18next.com/latest/usetranslation-hook) inside a React component to access strings in a given namespace. The hook returns a function called `t`.

2. Call the `t` function to get the translation for a string.

For example:

```ts
const { t } = useTranslation("myComponent");
return <p>{t("hello")}</p>;
```

### Add localization support to a component

1. Move English strings out of the component code, and into the `i18n` folder. Use a new namespace for logical groups of components or app views.

2. Replace strings hard-coded in source code with calls to the `t()` function. Use `camelCase` for new localization keys.

<table><tr><th>Before</th><th>After</th></tr><tr><td>

```ts
function MyComponent() {
  return <p>Hello!</p>;
}
```

</td><td>

```ts
function MyComponent() {
  const { t } = useTranslation("myComponent");
  return <p>{t("hello")}</p>;
}
```

```ts
// i18n/en/myComponent.ts
export const myComponent = {
  hello: "Hello!",
};
```

</td></tr></table>

### Complete example

```ts
// MyComponent.ts

import { useTranslation } from "react-i18next";

function MyComponent(props: Props): React.JSX.Element {
  const { t } = useTranslation("myComponent");

  return <p>{t("hello")}</p>;
}
```

```ts
// i18n/en/myComponent.ts
export const myComponent = {
  hello: "Hello!",
};

// i18n/en/index.ts
export * from "./myComponent";
```

```ts
// i18n/zh/myComponent.ts
export const myComponent: Partial<TypeOptions["resources"]["myComponent"]> = {
  hello: "你好！",
};

// i18n/zh/index.ts
export * from "./myComponent";
```

Result:

| English         | Chinese         |
| --------------- | --------------- |
| `<p>Hello!</p>` | `<p>你好！</p>` |
