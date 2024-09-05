#!/bin/bash

# Setup script
clear

# Display setup message
echo "TrashUpload setup..."

# Check and install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Installing Docker..."
    # Installation command for Docker based on the OS
    # For Ubuntu/Debian:
    sudo apt-get update
    sudo apt-get install -y docker.io
    # For CentOS/RHEL:
    # sudo yum install -y docker
    # Start Docker service after installation
    sudo systemctl start docker
    sudo systemctl enable docker
else
    echo "Docker is already installed."
fi

# Step 1: Build the Docker image
echo "Building Docker image..."
docker build -t trash-upload .

# Check if the image was built successfully
if [[ $? -ne 0 ]]; then
    echo "Docker image build failed. Exiting..."
    exit 1
fi

# Step 2: Run the Docker container with nohup to free the terminal
echo "Running Docker container..."
nohup docker run -d -p 80:80 --name trash-upload-container trash-upload &

# Wait a moment for the container to start
sleep 2

# Check if the container started successfully
CONTAINER_ID=$(docker ps -q --filter "name=trash-upload-container")
if [ -z "$CONTAINER_ID" ]; then
    echo "Failed to start the Docker container. Please check the logs."
    exit 1
fi

# Get the running container details
IMAGE_ID=$(docker images -q trash-upload)
CONTAINER_NAME=$(docker inspect --format='{{.Name}}' "$CONTAINER_ID" | sed 's/\///')

# Display running container details
echo "Running TrashUpload in Docker: Container Name: $CONTAINER_NAME, Container ID: $CONTAINER_ID, Image ID: $IMAGE_ID on port 80"

# Optionally display the container logs
# echo "Container logs:"
# docker logs $CONTAINER_ID
