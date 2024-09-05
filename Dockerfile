# Use an official Node.js runtime as a parent image
FROM node:18

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install any needed packages specified in package.json
RUN npm install

# Copy the server script and any other necessary files to the working directory
COPY . .

# Create necessary directories and files with appropriate permissions
RUN mkdir -p uploads && \
    touch upload_log.json && \
    chmod -R 777 uploads upload_log.json

# Make port 80 available to the world outside this container
EXPOSE 80

# Define environment variable for production
ENV NODE_ENV=production

# Run the server script when the container launches
CMD ["node", "server.mjs"]
