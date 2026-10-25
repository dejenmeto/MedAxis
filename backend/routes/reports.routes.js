const express = require("express");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const reports = require("../controllers/reports.controller");

const router = express.Router();

router.use(authenticate);
router.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const reportUsers = ["super_admin", "hospital_admin", "accountant"];

router.get("/summary", authorize(...reportUsers), reports.summary);
router.get("/monthly", authorize(...reportUsers), reports.monthly);
router.get("/financial", authorize(...reportUsers), reports.financial);

module.exports = router;
