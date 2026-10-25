const express = require("express");
const authenticate = require("../middlewares/authenticate");
const controller = require("../controllers/ambulance.controller");

const router = express.Router();

router.use(authenticate);

router.get("/dashboard", controller.getDashboard);

router.get("/vehicles", controller.listVehicles);
router.post("/vehicles", controller.createVehicle);
router.put("/vehicles/:id", controller.updateVehicle);

router.get("/dispatches", controller.listDispatches);
router.post("/dispatches", controller.createDispatch);
router.patch("/dispatches/:id/status", controller.updateDispatchStatus);

module.exports = router;
