const express = require("express");
const router = express.Router();

const usersController = require("../controllers/users.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");

router.use(authenticate);

router.get(
  "/",
  authorize("super_admin", "hospital_admin"),
  usersController.list,
);

router.post(
  "/",
  authorize("super_admin", "hospital_admin"),
  usersController.create,
);

router.patch(
  "/:id",
  authorize("super_admin", "hospital_admin"),
  usersController.update,
);

router.patch(
  "/:id/deactivate",
  authorize("super_admin", "hospital_admin"),
  usersController.deactivate,
);

module.exports = router;
