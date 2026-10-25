const express = require("express");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const maternity = require("../controllers/maternity.controller");

const router = express.Router();

router.use(authenticate);

router.get("/summary", maternity.getSummary);
router.get("/:resource", maternity.list);

router.post(
  "/:resource",
  authorize("super_admin", "hospital_admin", "doctor", "nurse"),
  maternity.create,
);

router.put(
  "/:resource/:id",
  authorize("super_admin", "hospital_admin", "doctor", "nurse"),
  maternity.update,
);

router.delete(
  "/:resource/:id",
  authorize("super_admin", "hospital_admin"),
  maternity.remove,
);

module.exports = router;
