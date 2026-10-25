const express = require("express");
const { body } = require("express-validator");
const auth = require("../controllers/auth.controller");
const authenticate = require("../middlewares/authenticate");
const validate = require("../middlewares/validate");

const router = express.Router();

router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isString().notEmpty().isLength({ max: 200 }),
  ],
  validate,
  auth.login,
);

router.post("/refresh", auth.refresh);
router.post("/logout", auth.logout);
router.get("/me", authenticate, auth.me);

module.exports = router;
