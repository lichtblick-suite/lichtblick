# 3D

Display visualization markers with any of the following datatypes in a 2D or 3D scene. Click any given marker in the scene to display its relevant details in a dialog box.

#### Can display the following datatypes:

<table>
<tbody>
<tr>
<th> Transform </th>
<td>

[`tf/tfMessage`](http://docs.ros.org/en/noetic/api/tf/html/msg/tfMessage.html)
[`tf2_msgs/TFMessage`](http://docs.ros.org/en/noetic/api/tf2_msgs/html/msg/TFMessage.html)
[`tf2_msgs/msg/TFMessage`](https://github.com/ros2/geometry2/blob/ros2/tf2_msgs/msg/TFMessage.msg)
[`geometry_msgs/TransformStamped`](http://docs.ros.org/en/noetic/api/geometry_msgs/html/msg/TransformStamped.html)
[`geometry_msgs/msg/TransformStamped`](https://github.com/ros2/common_interfaces/blob/master/geometry_msgs/msg/TransformStamped.msg)

</td>
</tr>

<tr>
<th> Laser scan </th>
<td>

[`sensor_msgs/LaserScan`](http://docs.ros.org/en/noetic/api/sensor_msgs/html/msg/LaserScan.html)
[`sensor_msgs/msg/LaserScan`](https://github.com/ros2/common_interfaces/blob/master/sensor_msgs/msg/LaserScan.msg)

</td>
</tr>

<tr>
<th> Occupancy grid </th>
<td>

[`nav_msgs/OccupancyGrid`](http://docs.ros.org/en/noetic/api/nav_msgs/html/msg/OccupancyGrid.html)
[`nav_msgs/msg/OccupancyGrid`](https://github.com/ros2/common_interfaces/blob/master/nav_msgs/msg/OccupancyGrid.msg)

</td>
</tr>

<tr>
<th>

[Marker](http://wiki.ros.org/rviz/DisplayTypes/Marker)

</th>
<td>

[`visualization_msgs/Marker`](http://docs.ros.org/en/noetic/api/visualization_msgs/html/msg/Marker.html)
[`visualization_msgs/msg/Marker`](https://github.com/ros2/common_interfaces/blob/master/visualization_msgs/msg/Marker.msg)
[`visualization_msgs/MarkerArray`](http://docs.ros.org/en/noetic/api/visualization_msgs/html/msg/MarkerArray.html)
[`visualization_msgs/msg/MarkerArray`](https://github.com/ros2/common_interfaces/blob/master/visualization_msgs/msg/MarkerArray.msg)

</td>
</tr>

<tr>
<th> Path </th>
<td>

[`nav_msgs/Path`](http://docs.ros.org/en/noetic/api/nav_msgs/html/msg/Path.html)
[`nav_msgs/msg/Path`](https://github.com/ros2/common_interfaces/blob/master/nav_msgs/msg/Path.msg)

</td>
</tr>

<tr
><th> Point cloud </th>
<td>

[`sensor_msgs/PointCloud2`](http://docs.ros.org/en/noetic/api/sensor_msgs/html/msg/PointCloud2.html)
[`sensor_msgs/msg/PointCloud2`](https://github.com/ros2/common_interfaces/blob/master/sensor_msgs/msg/PointCloud2.msg)

</td>
</tr>

<tr>
<th> Polygon </th>
<td>

[`geometry_msgs/PolygonStamped`](http://docs.ros.org/en/noetic/api/geometry_msgs/html/msg/PolygonStamped.html)
[`geometry_msgs/msg/PolygonStamped`](https://github.com/ros2/common_interfaces/blob/master/geometry_msgs/msg/PolygonStamped.msg)

</td>

</tr>
<tr><th> Pose </th>
<td>

[`geometry_msgs/PoseStamped`](http://docs.ros.org/en/noetic/api/geometry_msgs/html/msg/PoseStamped.html)
[`geometry_msgs/msg/PoseStamped`](https://github.com/ros2/common_interfaces/blob/master/geometry_msgs/msg/PoseStamped.msg)

<tr>
<th> Velodyne scan </th>
<td>

[`velodyne_msgs/VelodyneScan`](http://docs.ros.org/en/noetic/api/velodyne_msgs/html/msg/VelodyneScan.html)
[`velodyne_msgs/msg/VelodyneScan`](https://github.com/ros-drivers/velodyne/blob/ros2/velodyne_msgs/msg/VelodyneScan.msg)

</td>
</tr>
<tr>
<th> Color </th>
<td>

[`std_msgs/ColorRGBA`](http://docs.ros.org/en/noetic/api/std_msgs/html/msg/ColorRGBA.html)
[`std_msgs/msg/ColorRGBA`](https://github.com/ros2/common_interfaces/blob/master/std_msgs/msg/ColorRGBA.msg)
or any datatype suffixed with `/Color` or `/ColorRGBA` and containing `r`, `g`, `b` fields

</td>
</tr>
</tbody>
</table>

## Shortcuts

#### To move the camera:

<kbd>w</kbd> – Forward

<kbd>a</kbd> – Left

<kbd>s</kbd> – Backward

<kbd>d</kbd> – Right

<kbd>z</kbd> or <kbd>Scroll up</kbd> – Zoom in

<kbd>x</kbd> or <kbd>Scroll down</kbd> – Zoom out

<kbd>Drag</kbd> – Parallel to the ground. Will disengage “follow” mode, if enabled.

<kbd>Right-click</kbd> + <kbd>drag</kbd> – Pan and rotate. Dragging horizontally rotates around the world's z-axis; dragging vertically pans around the x and y axes

<kbd>Shift</kbd> + <kbd>other action</kbd> – Adjusts all values to be 1/10 of baseline values; allows for more precise movements and adjustments

#### Other:

<kbd>t</kbd> – Open topic picker

<kbd>Esc</kbd> – Close topic picker

<kbd>Cmd</kbd> + <kbd>f</kbd> – Search for marker text

[Learn more](https://foxglove.dev/docs/panels/3d).
