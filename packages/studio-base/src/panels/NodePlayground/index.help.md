# Node Playground

Use a code editor sandbox to write nodes that publish pseudo-ROS topics internally to Studio. Manipulate, reduce, and filter existing ROS messages and output them in a way that is useful to you.

_Node Playground_ uses TypeScript to typecheck messages coming in and out of your nodes.

When you create a new node, you’ll be presented with some boilerplate to get started. There, you'll see that every node must declare 3 exports:

- Inputs array of topic names
- Output topic with an enforced prefix: `/studio_node/`
- Publisher function that takes messages from input topics and publishes messages under your output topic

Here is a basic node that echoes its input on a new output topic, `/studio_node/echo`:

```typescript
import { Input, Messages } from "ros";

export const inputs = ["/rosout"];
export const output = "/studio_node/echo";

const publisher = (message: Input<"/rosout">): Messages.rosgraph_msgs/Log => {
  return message.message;
};

export default publisher;
```

To debug your code, invoke `log(someValue, anotherValue)` to print non-function values to the Logs section at the bottom of the panel.

You can write more complex nodes that output custom datatypes or listen to multiple input topics. You can even reference [variables](https://foxglove.dev/docs/app-concepts/variables) or import the utility functions listed in the sidebar's "Utilities" tab.

[Learn more](https://foxglove.dev/docs/panels/node-playground).
