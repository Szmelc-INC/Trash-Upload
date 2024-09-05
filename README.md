# Trash-Upload
### > Temporary file upload service (inspired by bashupload.com)
![image](https://github.com/user-attachments/assets/c76c4c1e-b00a-4afc-b42e-73933fc840fc)


## Quick Setup w Docker:
```bash
git clone https://github.com/GNU-Szmelc/Trash-Upload && cd Trash-Upload && clear && bash setup.sh
```

## Usage:
### === Client ===
> Upload file (single use only)
```bash
curl -F file=@/path/to/your/file http://server-ip/
```
> Upload file (Unlimited downloads, expires after 24h) [Add ?d24=true at the end of URL]
```bash
curl -F file=@/path/to/your/file http://server-ip/?d24=true
```
Example: 
```bash
curl -F file=@test.jpeg szmelc.com
```

### === Server ===
Manage running service (server side):
```bash
# check Container ID with
docker ps

# run
docker exec -it <Container ID> /bin/bash

# cd & ls
cd /usr/src/app/uploads
ls -lh

# Manage image / container:
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
