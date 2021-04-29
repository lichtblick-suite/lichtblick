FROM ros:noetic-robot-focal

RUN apt-get update && apt-get install -y \
  ros-noetic-ros-tutorials \
  xvfb \
  && rm -rf /var/lib/apt/lists/*

RUN useradd -ms /bin/bash rosuser

# Enable sudo for rosuser
RUN adduser rosuser sudo
RUN echo '%sudo ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

USER rosuser
ENV HOME=/home/rosuser
WORKDIR /home/rosuser

COPY container-scripts/build.sh /home/rosuser/build.sh
COPY container-scripts/entrypoint.sh /home/rosuser/entrypoint.sh

# ROS build and auto-configure on bash login
RUN /home/rosuser/build.sh
RUN echo "source ~/catkin_ws/devel/setup.bash" >> /home/rosuser/.bashrc

ENTRYPOINT [ "/bin/bash", "/home/rosuser/entrypoint.sh" ]
