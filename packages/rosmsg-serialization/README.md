# rosmsg-serialization

Serialize and deserialize ArrayBuffers using [ROS Message serialization format](http://wiki.ros.org/msg).

## LazyMessage

Lazy messages provide on-demand access and deserialization to fields of a serialized ROS message. Creating
a lazy message from a buffer performs no de-serialization during creation. Only accessed fields are
deserialized; the deserialization occurs at access time.

```Typescript
import { LazyMessageReader } from "@foxglove/rosmsg-serialization";

// message definition comes from @foxglove/rosmsg
const reader = new LazyMessageReader(messageDefinition);

// build a new lazy message instance for our serialized message from the Uint8Array
// Note: since deserialization is lazy - avoid-reusing the array you provide for other messages
const message = reader.readMessage([0x00, 0x00, ...]);

// access message fields
message.header.stamp;
```

## MessageWriter

Convert an object, array, or primitive value into binary data using ROS message serialization.

```Typescript
import { MessageWriter } from "@foxglove/rosmsg-serialization";

// message definition comes from @foxglove/rosmsg
const writer = new MessageWriter(pointStampedMessageDefinition);

// serialize the passed in object to a Uint8Array as a geometry_msgs/PointStamped message
const uint8Array = writer.writeMessage({
  header: {
    seq: 0,
    stamp: { sec: 0, nsec: 0 },
    frame_id: ""
  },
  x: 1,
  y: 0,
  z: 0
});
```
