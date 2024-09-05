#!/bin/bash

# Clear the screen
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

# Create SSL directory if it doesn't exist
SSL_DIR="./ssl"
if [ ! -d "$SSL_DIR" ]; then
    echo "Creating ssl directory..."
    mkdir -p $SSL_DIR
fi

# Ask the user if they want to manually provide SSL certificates or generate new ones
echo "Do you want to (1) provide your own SSL certificates or (2) generate new ones using Let's Encrypt? Enter 1 or 2:"
read -r SSL_OPTION

if [ "$SSL_OPTION" == "1" ]; then
    echo "Please place your SSL certificate (cert.pem) and private key (key.pem) in the 'ssl' directory."
    read -p "Press Enter to continue after placing the files..."

    # Check if files are present
    if [ ! -f "$SSL_DIR/cert.pem" ] || [ ! -f "$SSL_DIR/key.pem" ]; then
        echo "SSL files not found in the 'ssl' directory. Exiting..."
        exit 1
    fi
elif [ "$SSL_OPTION" == "2" ]; then
    echo "Generating SSL certificates using Let's Encrypt..."

    # Install Certbot if not already installed
    if ! command -v certbot &> /dev/null; then
        echo "Certbot is not installed. Installing Certbot..."
        sudo apt-get update
        sudo apt-get install -y certbot
    fi

    # Prompt user for domain and email
    read -p "Enter your domain name (e.g., example.com): " DOMAIN
    read -p "Enter your email address for Let's Encrypt notifications: " EMAIL

    # Run Certbot to generate certificates
    sudo certbot certonly --standalone -d $DOMAIN --agree-tos -m $EMAIL

    # Copy the generated certificates to the ssl directory
    sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem $SSL_DIR/cert.pem
    sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem $SSL_DIR/key.pem

    echo "SSL certificates generated and copied to the 'ssl' directory."
else
    echo "Invalid option selected. Exiting..."
    exit 1
fi

# Step 4: Run the Docker container with SSL support
echo "Running Docker container with SSL support..."
nohup docker run -d -p 80:80 -p 443:443 -v $(pwd)/ssl:/usr/src/app/ssl:ro --name trash-upload-container trash-upload > nohup.out 2>&1 &

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
echo "Running TrashUpload in Docker: Container Name: $CONTAINER_NAME, Container ID: $CONTAINER_ID, Image ID: $IMAGE_ID on ports 80 and 443"
