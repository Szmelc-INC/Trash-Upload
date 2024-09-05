import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import shortid from 'shortid';
import chalk from 'chalk';

const app = express();
const PORT = 80;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDirectory = path.join(__dirname, 'uploads');
const logFilePath = path.join(__dirname, 'upload_log.json');
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB
const DAILY_LIMIT = 10 * 1024 * 1024 * 1024; // 10 GB

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

    // Check the query parameter 'd24' instead of a form field
    metadata[req.file.filename] = req.query.d24 === 'true';

    const downloadCommand = `wget ${fileUrl}`;

    // Log the upload event to the server console
    console.log(`New upload: [${req.file.filename}] [${(fileSize / (1024 * 1024)).toFixed(2)} MB]`);

    // Send plain text response to client with chalk for colored text
    res.setHeader('Content-Type', 'text/plain');
    res.send(`\n\n\n\n\n\n ================================================ \n\n File uploaded successfully. \n You can download it using the command:\n\n${chalk.rgb(255, 165, 0)(downloadCommand)}\n\n Thanks for choosing TrashUpload! - [Szmelc.INC]\n\n ================================================ \n\n`);

    // Schedule file deletion after 24 hours, regardless of single download or 24-hour retention
    scheduleFileDeletion(filePath, 24 * 60 * 60 * 1000);
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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
