Write code to manipulate, aggregate, and filter existing messages on topics and output them to new topics for other Studio panels to visualize.

_User Scripts_ are written in [TypeScript](https://www.typescriptlang.org/).

When you create a new script, you’ll be presented with some boilerplate to get started. Every script must declare 3 [exports](https://www.typescriptlang.org/docs/handbook/modules.html#export):

- `inputs: string[]` – An array of topic names
- `output: string` – Topic for your node's output messages
- `node: (event: MessageEvent, variables: {}) => unknown` – Function that takes your `inputs` and publishes new messages on your `output`

Check out the _templates_ within the editor for sample nodes.

To debug your code, call `log(someValue, anotherValue)` to print values to the Logs section at the bottom of the editor panel.

You can write more complex nodes that output custom datatypes or listen to multiple input topics. You can even reference [variables](https://foxglove.dev/docs/app-concepts/variables) or import the utility functions listed in the sidebar's "Utilities" tab.

[View docs](https://foxglove.dev/docs/panels/node-playground).
