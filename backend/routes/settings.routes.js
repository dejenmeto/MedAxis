const express = require("express");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const settings = require("../controllers/settings.controller");

const router = express.Router();

router.use(authenticate);

const allowedRoles = ["super_admin", "hospital_admin"];

router.get("/", authorize(...allowedRoles), settings.getSettings);
router.put("/", authorize(...allowedRoles), settings.updateSettings);

module.exports = router;
