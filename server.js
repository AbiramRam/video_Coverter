const express = require('express');
const multer = require('multer');
const http = require('http');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

let currentConversion = null; // Track current ffmpeg process

app.post('/convert', upload.single('video'), (req, res) => {
    const inputFile = req.file.path;
    const outputFormat = req.body.format;
    const outputFile = `output-${Date.now()}.${outputFormat}`;
    const socketId = req.body.socketId;

    currentConversion = ffmpeg(inputFile)
        .output(outputFile)
        .on('start', () => {
            console.log(`Started processing: ${inputFile}`);
        })
        .on('progress', (progress) => {
            if (socketId) {
                io.to(socketId).emit('conversionProgress', progress.percent);
            }
        })
        .on('end', () => {
            console.log(`Finished processing: ${outputFile}`);
            fs.unlink(inputFile, (err) => {
                if (err) console.error(`Error deleting input file: ${err}`);
            });
            if (socketId) {
                io.to(socketId).emit('conversionComplete', outputFile);
            }
            currentConversion = null; // Reset current conversion process
        })
        .on('error', (err) => {
            console.error(`Error: ${err.message}`);
            if (socketId) {
                io.to(socketId).emit('conversionError', 'Conversion error');
            }
            currentConversion = null; // Reset current conversion process on error
        })
        .run();

    res.json({ status: 'Conversion started' });
});

// Endpoint to cancel the ongoing conversion
app.post('/cancel', (req, res) => {
    if (currentConversion) {
        currentConversion.kill(); // Kill the ffmpeg process
        currentConversion = null; // Reset current conversion process
        res.status(200).json({ message: 'Conversion cancelled' });
    } else {
        res.status(404).json({ message: 'No active conversion to cancel' });
    }
});

app.get('/download', (req, res) => {
    const file = req.query.file;
    res.download(file, (err) => {
        if (err) {
            console.error(`Error downloading file: ${err}`);
        }

        fs.unlink(file, (err) => {
            if (err) console.error(`Error deleting output file: ${err}`);
        });
    });
});

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('cancelConversion', () => {
        if (currentConversion) {
            currentConversion.kill(); // Kill the ffmpeg process
            currentConversion = null; // Reset current conversion process
            console.log('Conversion cancelled by user');
        }
    });
});

server.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});
