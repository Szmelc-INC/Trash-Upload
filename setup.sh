#!/bin/bash

# Clear the screen
clear

# Display setup message
echo "TrashUpload setup..."

# Function to install Docker if not present
install_docker() {
    echo "Docker is not installed. Installing Docker..."
    # For Ubuntu/Debian:
    sudo apt-get update
    sudo apt-get install -y docker.io
    # Uncomment for CentOS/RHEL:
    # sudo yum install -y docker
    sudo systemctl start docker
    sudo systemctl enable docker
}

# Check and install Docker if not installed
if ! command -v docker &> /dev/null; then
    install_docker
else
    echo "Docker is already installed."
fi

# Step 1: Remove any existing containers with the same name
EXISTING_CONTAINER=$(docker ps -a -q --filter "name=trash-upload-container")

if [ ! -z "$EXISTING_CONTAINER" ]; then
    echo "Removing existing Docker container with name 'trash-upload-container'..."
    docker rm -f $EXISTING_CONTAINER
fi

# Step 2: Remove any existing images with the same name
EXISTING_IMAGE=$(docker images -q trash-upload)

if [ ! -z "$EXISTING_IMAGE" ]; then
    echo "Removing existing Docker image with name 'trash-upload'..."
    docker rmi -f $EXISTING_IMAGE
fi

# Step 3: Build the Docker image
echo "Building Docker image..."
docker build -t trash-upload .

# Check if the image was built successfully
if [[ $? -ne 0 ]]; then
    echo "Docker image build failed. Exiting..."
    exit 1
fi

# Step 4: Run the Docker container with nohup to free the terminal
echo "Running Docker container..."
nohup docker run -d -p 80:80 --name trash-upload-container trash-upload > nohup.out 2>&1 &

# Wait a moment for the container to start
sleep 5

# Check if the container started successfully
CONTAINER_ID=$(docker ps -q --filter "name=trash-upload-container")
if [ -z "$CONTAINER_ID" ]; then
    echo "Failed to start the Docker container. Please check the logs."
    
    # Display the last few lines of nohup.out for debugging
    echo "Displaying last 20 lines of nohup.out for debugging:"
    tail -n 20 nohup.out
    
    # Display docker logs if any container started but exited
    if docker ps -a --filter "name=trash-upload-container" --filter "status=exited" | grep "trash-upload-container"; then
        echo "Displaying Docker container logs:"
        docker logs trash-upload-container
    fi
    
    exit 1
fi

# Get the running container details
IMAGE_ID=$(docker images -q trash-upload)
CONTAINER_NAME=$(docker inspect --format='{{.Name}}' "$CONTAINER_ID" | sed 's/\///')

# Display running container details
echo "Running TrashUpload in Docker: Container Name: $CONTAINER_NAME, Container ID: $CONTAINER_ID, Image ID: $IMAGE_ID on port 80"
