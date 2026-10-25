const express = require("express");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const insurance = require("../controllers/insurance.controller");

const router = express.Router();

router.use(authenticate);

const managers = ["super_admin", "hospital_admin"];
const claimStaff = ["super_admin", "hospital_admin", "accountant"];

router.get("/summary", insurance.summary);
router.get("/:resource", insurance.list);

router.post(
  "/:resource",
  authorize(...managers, "accountant", "receptionist"),
  insurance.create,
);

router.put(
  "/:resource/:id",
  authorize(...managers, "accountant", "receptionist"),
  insurance.update,
);

router.delete("/:resource/:id", authorize(...managers), insurance.remove);

router.put(
  "/claims/:id/submit",
  authorize("super_admin", "hospital_admin", "accountant", "receptionist"),
  insurance.submitClaim,
);

router.put(
  "/claims/:id/review",
  authorize("super_admin", "hospital_admin", "accountant"),
  insurance.reviewClaim,
);

module.exports = router;
