# Trash-Upload
> Temporary file upload service (inspired by bashupload.com)

### Quick Setup w Docker:
```bash
git clone https://github.com/GNU-Szmelc/Trash-Upload && cd Trash-Upload && clear && bash setup.sh
```


### Howto
Inspect stored files by:
```bash
# check Container ID with
docker ps

# run
docker exec -it <Container ID> /bin/bash

# cd & ls
cd /usr/src/app/uploads
ls -lh
```

Manage image / container:
```bash
# List currently running containers
docker ps

# Which will output:
# <CONTAINER ID> <IMAGE> <COMMAND> <CREATED> <STATUS> <PORTS> <NAMES>

# Stop container
docker stop <CONTAINER ID>

# Start container
docker start <CONTAINER ID>

# Forcefully remove image
docker rmi -f trash-upload
```
