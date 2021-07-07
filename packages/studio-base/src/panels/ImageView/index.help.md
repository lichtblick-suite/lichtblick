# Image View

The Image View panel displays images from `sensor_msgs/Image` or `sensor_msgs/CompressedImage` topics.

16-bit images (`16UC1`) are currently displayed assuming the values fall into the 0–10000 range, consistent with the defaults of the ROS `image_view` tool.

The **markers** dropdown can be used to toggle on and off topics with type `visualization_msgs/ImageMarker`, which will be overlayed on top of the selected image topic. Note that markers are only available if the `CameraInfo` for the selected camera is being published. If the image is unrectified, the markers will be transformed based on `CameraInfo`.

Shortcuts:

- =: Zoom in
- -: Zoom out
- 0: Zoom 100%
