import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import shortid from 'shortid';
import chalk from 'chalk';
import http from 'http';
import https from 'https';

const app = express();
const HTTP_PORT = 80;
const HTTPS_PORT = 443;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDirectory = path.join(__dirname, 'uploads');
const logFilePath = path.join(__dirname, 'upload_log.json');
const indexPath = path.join(__dirname, 'index.html');
const sslDirectory = path.join(__dirname, 'ssl');
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB
const DAILY_LIMIT = 10 * 1024 * 1024 * 1024; // 10 GB

// Define SSL certificate paths
const privateKeyPath = path.join(sslDirectory, 'key.pem');
const certificatePath = path.join(sslDirectory, 'cert.pem');

// Load SSL certificates
const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
const certificate = fs.readFileSync(certificatePath, 'utf8');
const credentials = { key: privateKey, cert: certificate };

// Ensure upload and log directories exist
if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory);
}

if (!fs.existsSync(logFilePath)) {
    fs.writeFileSync(logFilePath, JSON.stringify({}));
}

const metadata = {};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${shortid.generate()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: MAX_FILE_SIZE }
});

const sanitizeFilename = (filename) => {
    const base = path.basename(filename);
    return base.replace(/[^a-zA-Z0-9._-]/g, '_');
};

const shouldKeepFor24Hours = (req) => {
    const headerValue = req.headers['trash-upload-expire'];
    if (typeof headerValue === 'string' && headerValue.toLowerCase() === '24h') {
        return true;
    }

    return req.query.d24 === 'true';
};

// Serve the index.html file for the root GET request
app.get('/', (req, res) => {
    res.sendFile(indexPath);
});

const scheduleFileDeletion = (filePath, duration) => {
    setTimeout(() => {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`File deleted automatically after ${duration / (1000 * 60 * 60)} hours: ${path.basename(filePath)}`);
        }
    }, duration);
};

const logUpload = (ip, filename, size) => {
    const log = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
    if (!log[ip]) log[ip] = [];
    log[ip].push({ filename, size, date: new Date().toISOString() });
    fs.writeFileSync(logFilePath, JSON.stringify(log, null, 2));
};

const getUserDailyUpload = (ip) => {
    const log = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
    if (!log[ip]) return 0;
    const today = new Date().toISOString().slice(0, 10);
    return log[ip]
        .filter(entry => entry.date.slice(0, 10) === today)
        .reduce((total, entry) => total + entry.size, 0);
};

app.post('/', upload.single('file'), (req, res) => {
    const userIP = req.ip;
    const userDailyUpload = getUserDailyUpload(userIP);
    const fileSize = req.file.size;

    if (userDailyUpload + fileSize > DAILY_LIMIT) {
        return res.status(400).send('Daily upload limit exceeded.');
    }

    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    logUpload(userIP, req.file.filename, fileSize);

    const filePath = path.join(uploadDirectory, req.file.filename);
    const fileUrl = `${req.protocol}://${req.get('host')}/download/${req.file.filename}`;

    metadata[req.file.filename] = shouldKeepFor24Hours(req);

    const downloadCommand = `wget ${fileUrl}`;

    console.log(`New upload: [${req.file.filename}] [${(fileSize / (1024 * 1024)).toFixed(2)} MB]`);

    // Check if the client accepts HTML or plain text
    const acceptHeader = req.headers['accept'];
    if (acceptHeader && acceptHeader.includes('text/html')) {
        // Send HTML response to client
        res.setHeader('Content-Type', 'text/html');
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Upload Successful - TrashUpload</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; padding: 0; }
                    .container { max-width: 600px; margin: auto; }
                    h1 { color: #333; }
                    pre { background-color: #f4f4f4; padding: 10px; border-radius: 5px; }
                    .code-container { position: relative; }
                    .copy-button { position: absolute; top: 10px; right: 10px; padding: 5px 10px; cursor: pointer; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>File Uploaded Successfully</h1>
                    <p>You can download your file using the command below:</p>
                    <div class="code-container">
                        <pre id="download-command">${downloadCommand}</pre>
                        <button class="copy-button" onclick="copyToClipboard()">Copy</button>
                    </div>
                    <p>Thank you for using TrashUpload!</p>
                    <p><a href="/">Back to Home</a></p>
                </div>
                <script>
                    function copyToClipboard() {
                        const codeBlock = document.getElementById('download-command');
                        navigator.clipboard.writeText(codeBlock.textContent).then(() => {
                            alert('Download command copied to clipboard!');
                        }).catch(err => {
                            console.error('Could not copy text: ', err);
                        });
                    }
                </script>
            </body>
            </html>
        `);
    } else {
        // Send plain text response to client with ANSI color for orange
        const orangeANSI = '\x1b[33m'; // ANSI escape code for orange/yellow color
        const resetANSI = '\x1b[0m';   // ANSI escape code to reset color

        res.setHeader('Content-Type', 'text/plain');
        res.send(`\n\n
 ================================================ 

 File uploaded successfully. 
 You can download it using the command:

 ${orangeANSI}${downloadCommand}${resetANSI}

 > Thanks for using TrashUpload! \n [By Szmelc.INC]

 ================================================ 
        \n\n`);
    }

    scheduleFileDeletion(filePath, 24 * 60 * 60 * 1000);
});

app.put('/', (req, res) => {
    res.status(400).send('Filename required in request URL. Example: curl -T file https://your-host/file');
});

app.put('/:filename', (req, res) => {
    const requestedPath = decodeURIComponent(req.path || '');
    const originalName = sanitizeFilename(req.params.filename || requestedPath);

    if (!originalName || originalName === '_' || originalName === '') {
        return res.status(400).send('Filename required in request URL. Example: curl -T file https://your-host/file');
    }

    const userIP = req.ip;
    const userDailyUpload = getUserDailyUpload(userIP);

    const contentLengthHeader = req.headers['content-length'];
    const declaredLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : null;

    if (declaredLength && (Number.isNaN(declaredLength) || declaredLength <= 0)) {
        return res.status(400).send('Invalid content length.');
    }

    if (declaredLength && declaredLength > MAX_FILE_SIZE) {
        return res.status(400).send('File exceeds maximum upload size.');
    }

    if (declaredLength && userDailyUpload + declaredLength > DAILY_LIMIT) {
        return res.status(400).send('Daily upload limit exceeded.');
    }

    const uniqueName = `${shortid.generate()}-${originalName}`;
    const filePath = path.join(uploadDirectory, uniqueName);
    const writeStream = fs.createWriteStream(filePath);

    let totalBytes = 0;
    let terminationReason = null;
    let terminationStatus = 400;

    const abortUpload = (status, message) => {
        terminationStatus = status;
        terminationReason = message;
        req.unpipe(writeStream);
        writeStream.destroy();
        req.destroy();
    };

    req.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_FILE_SIZE && !terminationReason) {
            abortUpload(400, 'File exceeds maximum upload size.');
        }
    });

    req.on('error', (err) => {
        console.error('Request error during upload:', err);
        if (!terminationReason) {
            terminationStatus = 500;
            terminationReason = 'Error receiving file.';
        }
    });

    writeStream.on('error', (err) => {
        console.error('Write stream error during upload:', err);
        if (!terminationReason) {
            terminationStatus = 500;
            terminationReason = 'Error storing file.';
        }
    });

    writeStream.on('close', () => {
        if (terminationReason) {
            if (fs.existsSync(filePath)) {
                fs.unlink(filePath, () => {});
            }
            if (!res.headersSent) {
                res.status(terminationStatus).send(terminationReason);
            }
            return;
        }

        fs.stat(filePath, (err, stats) => {
            if (err) {
                console.error('Failed to stat uploaded file:', err);
                if (fs.existsSync(filePath)) {
                    fs.unlink(filePath, () => {});
                }
                if (!res.headersSent) {
                    res.status(500).send('Error finalizing file upload.');
                }
                return;
            }

            const finalSize = stats.size;
            if ((!declaredLength && userDailyUpload + finalSize > DAILY_LIMIT)) {
                if (fs.existsSync(filePath)) {
                    fs.unlink(filePath, () => {});
                }
                if (!res.headersSent) {
                    return res.status(400).send('Daily upload limit exceeded.');
                }
                return;
            }

            logUpload(userIP, uniqueName, finalSize);

            const d24Enabled = shouldKeepFor24Hours(req);
            metadata[uniqueName] = d24Enabled;

            const fileUrl = `${req.protocol}://${req.get('host')}/download/${uniqueName}`;
            const downloadCommand = `wget ${fileUrl}`;

            console.log(`New upload: [${uniqueName}] [${(finalSize / (1024 * 1024)).toFixed(2)} MB]`);

            scheduleFileDeletion(filePath, 24 * 60 * 60 * 1000);

            res.setHeader('Content-Type', 'text/plain');
            res.send(`\n\n ================================================\n\n File uploaded successfully.\n You can download it using the command:\n\n ${downloadCommand}\n\n > Thanks for using TrashUpload! \n [By Szmelc.INC]\n\n ================================================\n\n`);
        });
    });

    req.pipe(writeStream);
});

app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadDirectory, filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath, (err) => {
            if (!err && !metadata[filename]) {
                fs.unlinkSync(filePath);
                delete metadata[filename];
                console.log(`File deleted after single download: ${filename}`);
            }
        });
    } else {
        res.status(404).send('File not found');
    }
});

// Create HTTP server
const httpServer = http.createServer(app);

// Create HTTPS server
const httpsServer = https.createServer(credentials, app);

// Start both servers
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`HTTP Server is running on port ${HTTP_PORT}`);
});

httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`HTTPS Server is running on port ${HTTPS_PORT}`);
});
