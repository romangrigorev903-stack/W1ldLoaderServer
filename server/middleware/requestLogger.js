const morgan = require('morgan');
const logger = require('../utils/logger');

const morganStream = {
    write: function (message) {
        logger.info(message.trim());
    }
};

const requestLogger = morgan('combined', { stream: morganStream });

module.exports = requestLogger;