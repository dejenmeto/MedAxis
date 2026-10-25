const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const controller = require("../controllers/infectionControl.controller");

router.use(authenticate);

router.get("/cases", controller.listCases);
router.post("/cases", controller.createCase);
router.patch("/cases/:id", controller.updateCase);

router.get("/actions", controller.listActions);
router.post("/actions", controller.createAction);
router.patch("/actions/:id", controller.updateAction);

module.exports = router;
