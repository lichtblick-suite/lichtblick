# Common Tasks in Lichtblick

This guide covers common tasks you'll perform when using Lichtblick.

## Working with Data Sources

### Opening a ROS Bag File

1. Click on "Open Data Source" in the top-left corner
2. Select "Open Local File"
3. Choose "ROS1 Bag" or "ROS2 Bag" depending on your file
4. Browse to and select your `.bag` file
5. Once loaded, the available topics will appear in the topic selector

### Connecting to a Live ROS System

1. Click on "Open Data Source" in the top-left corner
2. Select "Connect to ROS"
3. Enter the ROS Master URI (e.g., `http://localhost:11311`)
4. Click "Connect"
5. Once connected, available topics will appear in the topic selector

### Using Rosbridge WebSocket

1. Start Rosbridge server on your ROS system:
   ```bash
   roslaunch rosbridge_server rosbridge_websocket.launch
   ```
2. In Lichtblick, click on "Open Data Source"
3. Select "Rosbridge WebSocket"
4. Enter the WebSocket URL (e.g., `ws://localhost:9090`)
5. Click "Connect"

## Managing Layouts

### Creating a Custom Layout

1. Click on the "Layout" button in the top bar
2. Select "Create New Layout"
3. Enter a name for your layout
4. Begin adding panels by clicking the "Add Panel" button (+)

### Saving a Layout

1. After configuring your panels, click on the "Layout" button
2. Select "Save Layout" or "Save Layout As..."
3. If choosing "Save Layout As...", enter a name for the layout
4. Your layout will be saved for future use

### Importing/Exporting Layouts

#### To export a layout:
1. Click on the "Layout" button
2. Select "Layout Manager"
3. Find the layout you want to export
4. Click the export icon (↑) next to it
5. Choose a location to save the layout JSON file

#### To import a layout:
1. Click on the "Layout" button
2. Select "Layout Manager"
3. Click the import button (↓)
4. Browse to and select your layout JSON file
5. The imported layout will appear in your layouts list

## Working with Panels

### Adding a New Panel

1. Click the "Add Panel" button (+) in the top bar
2. Browse the panel catalog
3. Click on the panel type you want to add
4. The panel will be added to your layout
5. Configure the panel using its settings (gear icon)

### Configuring a Panel

1. Click the settings (gear) icon in the panel header
2. Adjust settings specific to the panel type
3. For most visualization panels:
   - Select topics to visualize
   - Configure display options
   - Set any filtering or transformation options
4. Settings are automatically saved

### Rearranging Panels

1. To move a panel, drag it by its header
2. To resize a panel, drag the edges or corners
3. To create a split view, drag a panel to the edge of another panel
4. To maximize a panel, double-click its header
5. To close a panel, click the X button in its header

## Visualizing Data

### Creating a Plot

1. Add a Plot panel to your layout
2. Open the panel settings (gear icon)
3. Click "Add Plot" to create a new plot series
4. Select a topic and field to plot
5. Adjust display settings (color, line width, etc.)
6. Click "Apply" to save your changes

### Visualizing 3D Data

1. Add a 3D panel to your layout
2. Open the panel settings
3. In the "Topics" tab, add the topics you want to visualize:
   - Point clouds
   - Coordinate frames (TF)
   - Robot models (URDF)
   - Markers
4. Configure display options for each topic
5. Use the mouse to navigate the 3D view:
   - Left-click + drag to rotate
   - Right-click + drag to pan
   - Scroll to zoom

### Viewing Raw Messages

1. Add a Raw Messages panel
2. Open its settings
3. Select the topics you want to view
4. Messages will appear as they are published
5. Use the search box to filter message content

## Advanced Features

### Creating Global Variables

1. Click on the "Variables" button in the top bar
2. Click "Add Variable"
3. Enter a name and value for the variable
4. Click "Create"
5. The variable can now be used in panels that support variables

### Working with User Scripts

1. Add a User Script panel to your layout
2. Write your script in the editor:
   ```typescript
   export default function userCode(data) {
     // Process data from input topics
     return {
       outputTopic: {
         // Your custom message
         value: data.inputTopic.value * 2
       }
     };
   }
   ```
3. Configure input and output topics
4. Click "Run" to execute your script

### Setting Up Event Markers

1. Navigate to the section of data you want to mark
2. Click the "Add Event" button in the status bar
3. Enter a name and description for the event
4. Select a color for the event marker
5. Click "Create"
6. The event marker will appear in the timeline

## Troubleshooting

### Resolving Connection Issues

1. Verify that your ROS system is running and accessible
2. Check network connectivity if connecting to a remote system
3. Ensure required ports are not blocked by firewalls
4. Try connecting via different methods (direct ROS, Rosbridge, etc.)

### Handling Large Data Files

1. For very large bag files, consider using the MCAP format
2. Use time filters to focus on specific sections of the data
3. Close panels you're not actively using to reduce resource usage
4. Apply topic filters to limit the amount of data being processed

### Resolving Layout Issues

1. If a layout becomes corrupted, try:
   - Restoring from a previous version
   - Importing from an exported backup
   - Creating a new layout and manually reconfiguring panels
2. If panels are not responsive, try:
   - Refreshing the page (web version)
   - Restarting the application (desktop version)
   - Checking the console for errors

## See Also

- [Adding Filters](./adding-filters.md) - Detailed guide on filtering data
- [User Guide](./user-guide.md) - Complete user guide with detailed instructions
- [API Documentation](./api/index.md) - API documentation for developers
