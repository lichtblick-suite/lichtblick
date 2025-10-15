# MoveIt PlanningScene Support

This document describes the MoveIt PlanningScene support that has been added to the Lichtblick 3D renderer.

## Overview

The system now supports displaying `moveit_msgs/PlanningScene` messages as simple markers in the 3D visualization. This provides a basic visualization of collision objects and planning scene data from MoveIt.

## Features

- **PlanningScene Visualization**: Displays collision objects from MoveIt planning scenes as simple wireframe cubes
- **Settings Panel**: Configurable visibility, collision object display, and colors through the settings panel
- **Real-time Updates**: Automatically updates when new PlanningScene messages are received

## Message Types Supported

- `moveit_msgs/PlanningScene` - Main planning scene message
- `moveit_msgs/CollisionObject` - Individual collision objects within the scene
- `moveit_msgs/RobotState` - Robot state information
- `moveit_msgs/PlanningSceneWorld` - World collision objects

## Usage

1. **Add a PlanningScene Topic**: In the 3D panel, add a topic that publishes `moveit_msgs/PlanningScene` messages
2. **Configure Settings**: Use the settings panel to:
   - Toggle visibility of the planning scene
   - Show/hide collision objects
   - Change the color of collision objects
3. **View Visualization**: Collision objects will appear as wireframe cubes in the 3D scene

## Implementation Details

### Files Added/Modified

- `packages/suite-base/src/types/MoveItMessages.ts` - TypeScript type definitions for MoveIt messages
- `packages/suite-base/src/types/MoveItMessageDefinitions.ts` - ROS message definitions for MoveIt types
- `packages/suite-base/src/util/basicDatatypes.ts` - Added MoveIt datatypes to the registry
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/moveit/RenderablePlanningScene.ts` - 3D visualization renderable
- `packages/suite-base/src/panels/ThreeDeeRender/renderables/moveit/PlanningSceneExtension.ts` - Scene extension for handling PlanningScene messages
- `packages/suite-base/src/panels/ThreeDeeRender/SceneExtensionConfig.ts` - Registered the new extension

### Architecture

The implementation follows the existing pattern used by other scene extensions:

1. **Message Definitions**: MoveIt message types are defined and registered in the basic datatypes registry
2. **Scene Extension**: `PlanningSceneExtension` handles message processing and settings management
3. **Renderable**: `RenderablePlanningScene` creates 3D visualization objects for collision objects
4. **Settings Integration**: Full integration with the settings panel for configuration

### Current Limitations

- **Simple Visualization**: Collision objects are displayed as basic wireframe cubes regardless of their actual geometry
- **Limited Geometry Support**: Only basic collision object visualization is implemented
- **No Robot Model**: Robot state visualization is not yet implemented
- **Basic Colors**: Simple color scheme without advanced material properties

## Future Enhancements

- Parse actual collision object geometry (boxes, spheres, meshes, etc.)
- Add robot model visualization from robot state
- Support for attached collision objects
- Enhanced material and lighting properties
- Support for octomap visualization
- Integration with MoveIt planning scene updates

## Testing

To test the MoveIt support:

1. Start a ROS system with MoveIt planning scene publisher
2. Open Lichtblick and add the 3D panel
3. Add a topic publishing `moveit_msgs/PlanningScene` messages
4. Verify that collision objects appear as wireframe cubes in the 3D scene
5. Test settings panel controls for visibility and color changes

## Dependencies

- ROS MoveIt packages
- `moveit_msgs` package
- Standard ROS geometry and sensor message types
