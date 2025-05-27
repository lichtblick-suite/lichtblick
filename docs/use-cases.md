# Lichtblick Use Cases

This document describes common use cases and workflows in Lichtblick, providing step-by-step guides for typical tasks.

## Table of Contents

1. [Loading and Playing Data](#loading-and-playing-data)
2. [Filtering Topics and Messages](#filtering-topics-and-messages)
3. [Creating Custom Visualizations](#creating-custom-visualizations)
4. [Publishing Messages](#publishing-messages)
5. [Working with Extensions](#working-with-extensions)
6. [Managing Layouts](#managing-layouts)
7. [Real-time Data Monitoring](#real-time-data-monitoring)
8. [Data Analysis Workflows](#data-analysis-workflows)

## Loading and Playing Data

### Use Case: Analyzing Recorded Robot Data

**Goal**: Load a recorded bag file and analyze sensor data from a robot mission.

**Steps**:

1. **Open Data Source**
   - Drag and drop a `.bag`, `.mcap`, or `.db3` file onto the application
   - Or use File → Open and select your data file
   - The system automatically detects the file format

2. **Explore Available Topics**
   - View the topic list in the sidebar
   - See message counts and data types for each topic
   - Check the timeline for data coverage

3. **Control Playback**
   - Use the playback controls (play, pause, loop)
   - Adjust playback speed (0.1x to 2.0x)
   - Seek to specific timestamps
   - Set loop points for repeated analysis

4. **Add Visualization Panels**
   - Click "Add Panel" to see available visualizations
   - Common panels for robot data:
     - 3D Scene: Visualize point clouds, markers, and robot models
     - Image: View camera feeds
     - Plot: Graph sensor values over time
     - Raw Messages: Inspect message contents

### Example: Debugging Sensor Fusion

```
1. Load bag file containing /imu, /gps, and /odometry topics
2. Add Plot panel for IMU acceleration
3. Add Plot panel for GPS position
4. Add 3D Scene showing odometry path
5. Synchronize time across all panels
6. Identify timestamp misalignments or sensor drift
```

## Filtering Topics and Messages

### Use Case: Focus on Specific Data Streams

**Goal**: Filter large datasets to show only relevant information.

**Topic Filtering**:

1. **In Topic List**
   - Use the search box to filter topics by name
   - Regular expressions supported (e.g., `/camera.*` for all camera topics)
   - Toggle topic visibility with checkboxes

2. **In Panels**
   - Most panels have topic selection dropdowns
   - Multi-select supported in many panels
   - Some panels support topic patterns

**Message Filtering**:

1. **By Time Range**
   - Set start/end times in playback controls
   - Use timeline markers to define regions

2. **By Message Content**
   - In Raw Messages panel, use filter expressions
   - Examples:
     ```
     header.frame_id == "base_link"
     velocity.linear.x > 1.0
     status.level == 2
     ```

3. **By Frequency**
   - Some panels support decimation (show every Nth message)
   - Useful for high-frequency topics like IMU data

### Advanced Filtering with User Scripts

Create custom filters using the User Script panel:

```javascript
// Filter messages based on complex criteria
export const inputs = ["/diagnostics"];
export const output = "/filtered_diagnostics";

export default function script(event) {
  const { message } = event;
  
  // Only pass critical errors
  const criticalStatuses = message.status.filter(
    status => status.level === 2 && 
    status.name.includes("motor")
  );
  
  if (criticalStatuses.length > 0) {
    return {
      ...message,
      status: criticalStatuses
    };
  }
}
```

## Creating Custom Visualizations

### Use Case: Domain-Specific Data Display

**Goal**: Create custom visualization for proprietary message types.

**Using Extensions**:

1. **Create Extension Structure**
   ```
   my-extension/
   ├── package.json
   ├── src/
   │   ├── index.ts
   │   └── MyCustomPanel.tsx
   ```

2. **Define Panel Component**
   ```typescript
   import { PanelExtensionContext, RenderState } from "@lichtblick/suite";
   
   function MyCustomPanel({ context }: { context: PanelExtensionContext }): JSX.Element {
     const [renderState, setRenderState] = useState<RenderState>();
     
     useEffect(() => {
       context.subscribe(["/my_custom_topic"]);
       context.watch("currentFrame");
       
       context.onRender = (renderState) => {
         setRenderState(renderState);
       };
     }, [context]);
     
     // Render your visualization
     return <div>{/* Custom visualization */}</div>;
   }
   ```

3. **Register Panel**
   ```typescript
   export function activate(context: ExtensionContext) {
     context.registerPanel({
       name: "My Custom Panel",
       component: MyCustomPanel,
     });
   }
   ```

**Using User Scripts**:

For simpler visualizations, use the User Script panel with custom markers:

```javascript
export const inputs = ["/sensor_data"];
export const output = "/visualization_markers";

export default function script(event) {
  const { message } = event;
  
  // Create visualization markers
  return {
    markers: [{
      header: { frame_id: "map" },
      type: 2, // SPHERE
      pose: {
        position: { x: message.x, y: message.y, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 }
      },
      scale: { x: message.intensity, y: message.intensity, z: message.intensity },
      color: { r: 1, g: 0, b: 0, a: 0.5 }
    }]
  };
}
```

## Publishing Messages

### Use Case: Robot Control and Testing

**Goal**: Send control commands to a robot or test message handling.

**Manual Publishing**:

1. **Add Publish Panel**
   - Click "Add Panel" → "Publish"
   - Select target topic
   - Choose message type

2. **Configure Message**
   - Fill in message fields
   - Use JSON mode for complex messages
   - Save message templates for reuse

3. **Publish Options**
   - Single publish: Send once
   - Repeat: Send at specified rate
   - Burst: Send multiple messages quickly

**Example: Velocity Command**
```json
{
  "linear": {
    "x": 1.0,
    "y": 0.0,
    "z": 0.0
  },
  "angular": {
    "x": 0.0,
    "y": 0.0,
    "z": 0.5
  }
}
```

**Programmatic Publishing**:

Use Variable Sliders for interactive control:

1. Add Variable Slider panel
2. Configure variable (e.g., `$speed`)
3. Reference in Publish panel: `{"linear": {"x": $speed}}`
4. Adjust slider to send varying commands

## Working with Extensions

### Use Case: Extending Lichtblick Functionality

**Installing Extensions**:

1. **From Marketplace**
   - Open Extensions panel
   - Browse available extensions
   - Click "Install" on desired extension

2. **From Local File**
   - Package extension as `.zip`
   - Drag onto Extensions panel
   - Or use "Install from file" button

**Creating Extensions**:

See [Extension Development Guide](#creating-custom-visualizations) above.

**Managing Extensions**:

- Enable/disable without uninstalling
- Configure extension settings
- Check for updates
- View extension logs for debugging

## Managing Layouts

### Use Case: Workspace Organization

**Goal**: Create reusable workspace configurations for different tasks.

**Creating Layouts**:

1. **Arrange Panels**
   - Drag panels to desired positions
   - Resize using dividers
   - Create tabs for panel groups
   - Use fullscreen for focused work

2. **Configure Each Panel**
   - Select appropriate topics
   - Adjust visualization settings
   - Set filters and options

3. **Save Layout**
   - File → Save Layout
   - Give descriptive name
   - Add tags for organization

**Layout Examples**:

**Debugging Layout**:
- Raw Messages (left): All topics
- 3D Scene (center): Visualization
- Diagnostics (right): System status
- Plot (bottom): Key metrics

**Monitoring Layout**:
- Multiple Plot panels for metrics
- Image panels for cameras
- Table for latest values
- Log panel for errors

**Sharing Layouts**:

1. Export layout to file
2. Share with team members
3. Import on other machines
4. Version control layout files

## Real-time Data Monitoring

### Use Case: Live Robot Operations

**Goal**: Monitor robot status and sensor data in real-time.

**Connecting to Live Sources**:

1. **WebSocket Connection**
   ```
   ws://robot.local:8765
   ```

2. **ROSBridge Connection**
   ```
   ws://robot.local:9090
   ```

3. **Direct ROS Connection**
   - Requires ROS environment
   - Auto-discovers ROS master

**Monitoring Setup**:

1. **Critical Metrics Dashboard**
   - Battery voltage plot
   - Temperature monitoring
   - CPU/Memory usage
   - Network latency

2. **Sensor Health**
   - Diagnostics panel for status
   - Message frequency monitoring
   - Data quality indicators

3. **Alert Configuration**
   - Use conditional formatting
   - Set threshold indicators
   - Audio alerts for critical events

## Data Analysis Workflows

### Use Case: Post-Mission Analysis

**Goal**: Analyze collected data to improve robot performance.

**Statistical Analysis**:

1. **Add Table Panel**
   - Configure to show statistics
   - Min, max, mean, std deviation
   - Message counts and rates

2. **Export Data**
   - Select time range
   - Choose topics to export
   - Export as CSV for external analysis

**Performance Profiling**:

1. **Timing Analysis**
   - Plot message delays
   - Identify bottlenecks
   - Check synchronization

2. **Resource Usage**
   - Plot CPU/memory over time
   - Correlate with robot activities
   - Identify optimization opportunities

**Comparison Workflows**:

1. **Side-by-side Comparison**
   - Load multiple bag files
   - Synchronize playback
   - Use linked plots

2. **Overlay Visualization**
   - Plot multiple runs on same graph
   - Use different colors/styles
   - Statistical comparison

### Advanced Analysis Example

```javascript
// Compute trajectory smoothness metric
export const inputs = ["/odometry"];
export const output = "/smoothness_metric";

const positionHistory = [];

export default function script(event) {
  const { message } = event;
  const position = message.pose.pose.position;
  
  positionHistory.push(position);
  if (positionHistory.length > 100) {
    positionHistory.shift();
  }
  
  // Calculate jerk (rate of acceleration change)
  if (positionHistory.length >= 3) {
    const jerk = calculateJerk(positionHistory);
    return {
      value: jerk,
      timestamp: event.receiveTime
    };
  }
}
```

## Best Practices

### Performance Optimization

1. **Large Datasets**
   - Use topic filtering to reduce processing
   - Limit plot window duration
   - Disable unnecessary panels
   - Use decimation for high-frequency data

2. **Memory Management**
   - Close unused panels
   - Clear message caches periodically
   - Use streaming mode for large files

### Workflow Tips

1. **Keyboard Shortcuts**
   - Space: Play/pause
   - Shift+Space: Play in reverse
   - [ / ]: Step frame by frame
   - Cmd/Ctrl+K: Command palette

2. **Panel Management**
   - Double-click title bar to maximize
   - Shift+drag to duplicate panel
   - Right-click for panel options

3. **Data Organization**
   - Use consistent topic naming
   - Add metadata to bag files
   - Document custom message types
   - Version control layout files

---

For more information, see:
- [Architecture Overview](architecture-overview.md)
- [API Documentation](api-documentation.md)
- [Extension Development](api-documentation.md#extension-api)