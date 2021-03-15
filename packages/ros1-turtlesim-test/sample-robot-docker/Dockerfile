FROM ros:noetic-robot-focal

RUN apt-get update && apt-get install -y \
  ros-noetic-ros-tutorials \
  xvfb \
  && rm -rf /var/lib/apt/lists/*

RUN useradd -ms /bin/bash rosuser

USER rosuser
ENV HOME=/home/rosuser
WORKDIR /home/rosuser

COPY entrypoint.sh /home/rosuser/entrypoint.sh

ENTRYPOINT [ "/bin/bash", "/home/rosuser/entrypoint.sh" ]
