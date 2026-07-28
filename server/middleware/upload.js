const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = process.env.UPLOAD_TEMP_DIR || path.join(os.tmpdir(), 'w1ld-uploads');
        try { fs.mkdirSync(uploadDir, { recursive: true }); } catch (e) {}
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const basename = Date.now() + '-' + Math.random().toString(16).slice(2);
        cb(null, basename + ext);
    }
});

const fileFilter = function (req, file, cb) {
    const allowedExts = ['.zip', '.exe', '.jar'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only .zip, .exe and .jar files are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 500 * 1024 * 1024
    }
});

module.exports = upload;
