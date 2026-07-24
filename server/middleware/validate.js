const Joi = require('joi');

function validate(schema) {
    return function (req, res, next) {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });

        if (error) {
            const messages = error.details.map(function (detail) {
                return detail.message;
            });
            return res.status(400).json({ success: false, error: messages.join('; ') });
        }

        req.body = value;
        next();
    };
}

module.exports = validate;