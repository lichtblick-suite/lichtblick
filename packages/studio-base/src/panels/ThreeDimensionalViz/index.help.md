# 3D

Plots visualization messages in a 3D scene. You can select topics using the left-hand topic list; you can toggle the ability to follow orientation and manually select the frame you follow in the right-hand controls. Selected topics will have their messages visualized within the 3D scene. Topic selection is part of the configuration and will be saved between reloads and can be shared with `Import / Export Layout`. This panel can be expanded / collapsed by clicking on the caret icon to the left of it.

By default the scene will follow the center of a frame. When you move the camera, the camera will be offset from the center of that frame, but stay relative to that center.

You can toggle between a 3D perspective camera and a top-down, 2D orthographic camera of the scene by clicking on the _toggle 2D / 3D_ button in the top left of the 3D view panel.

`Left-click + drag` on the scene to move the camera position parallel to the ground. If 'follow' mode is on this will disengage it.

`Right-click + drag` on the scene to pan and rotate the camera. Dragging left/right will rotate the camera around the Z axis, and in 3D camera mode dragging top/bottom will pan the camera around the world's x/y axis.

`Mouse-wheel` controls the 'zoom' of the camera. Wheeling "up" will zoom the camera closer in while wheeling "down" will zoom the camera farther away.

Holding down `shift` in while performing any interaction with the camera will adjust values by 1/10th of their normal adjustments. This allows precision movements and adjustments to the camera.

_tip: If you get 'lost' in the scene and end up looking into infinite blank space and can't find your way back try clicking on 'follow' to snap the camera back to the default position._

## Keyboard shortcuts

In 3D camera mode, you can also use "shooter controls" (like those found in most popular desktop first-person shooter games) of `w` `a` `s` `d` to move the camera forward / left / backwards / right respective to the camera's position, and use `z` `x` to zoom in and out. It's easy to get lost when using these controls as there is nothing anchoring the camera to the scene.

You can use `t` to open the Topic Tree and `Esc` to close it again.

## Interacting with markers

Markers can be selected to see details about them. Open the "Interactions" panel from the right-side controls and click a marker to see information such as the topic name and marker contents.

Clicking on a point in a point cloud offers additional information, such as the color and coordinates of the point clicked. Selecting a point cloud also allows exporting all points from the point cloud message as a CSV.

### Linking selected markers to global variables

It's possible to link fields from a selected marker to global variables. In the "Selected object" tab of the "Interactions" panel, hover over a key in the JSON view of the marker. A button should appear that, when clicked, opens a dialog box that allows linking the field to a global variable.

When a global variable is linked, selecting another marker that contains the same key will update the global variable. For example, with the tracked object "id" field linked to the global variable "$trackedObjectId", clicking another tracked object will update the "$trackedObjectId" field. This makes it easy to use the information about selected markers in other panels.
