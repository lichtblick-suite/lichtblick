# rosmsg-deser

Deserialize ArrayBuffers using [ROS Message serialization format](http://wiki.ros.org/msg).

## LazyMessage

Lazy messages provide on-demand access and deserialization to fields of a serialized ROS message. Creating
a lazy message from a buffer performs no de-serialization during creation. Only accessed fields are
deserialized; the deserialization occurs at access time.

```Typescript
import { LazyMessageReader } from "@foxglove/rosmsg-deser";

// message definition comes from rosbag.js
const reader = new LazyMessageReader(messageDefinition);

// build a new lazy message instance for our serialized message from the Uint8Array
// Note: since deserialization is lazy - avoid-reusing the array you provide for other messages
const message = reader.readMessage([0x00, 0x00, ...]);

// access message fields
message.header.stamp;
```
