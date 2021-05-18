# rosmsg

Parse ROS message definitions

```Typescript
import { parse } from "@foxglove/rosmsg";

const parsedMsgDef = parse(`
    string name
    int32 var
`);
```
