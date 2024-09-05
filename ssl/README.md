# Certificates [Https] [443]
> Insert `key.pem` and `cert.pem` certificates here

### Generate certificates:
```bash
sudo certbot certonly --standalone -d szmelc.com -d www.szmelc.com
```
> After creating and verifying certificates, move them to project dir

```bash
# cd to Trash-Upload/ssl dir
cp /etc/letsencrypt/live/szmelc.com/privkey.pem ./key.pem
cp /etc/letsencrypt/live/szmelc.com/fullchain.pem ./cert.pem

# Make sure there are files in ssl dir
ls
```
