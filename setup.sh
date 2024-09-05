#!/bin/bash

# Simple setup script

# Step 1: Build the Docker image
docker build -t trash-upload .

# Step 2: Run the Docker container
docker run -p 80:80 trash-upload
