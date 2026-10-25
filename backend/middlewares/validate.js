const { validationResult } = require("express-validator");

function validate(req, res, next) {
  const result = validationResult(req);

  if (!result.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: "Please correct the submitted data.",
      errors: result.array().map(({ path, msg }) => ({
        field: path,
        message: msg,
      })),
    });
  }

  next();
}

module.exports = validate;
