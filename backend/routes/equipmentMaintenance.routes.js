const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const controller = require("../controllers/equipmentMaintenance.controller");

// All endpoints require a valid login.
router.use(authenticate);

// Equipment CRUD (deactivation preserves records).
router.get("/equipment", controller.listEquipment);
router.post("/equipment", controller.createEquipment);
router.patch("/equipment/:id", controller.updateEquipment);
router.patch("/equipment/:id/deactivate", controller.deactivateEquipment);

// Maintenance work orders.
router.get("/orders", controller.listOrders);
router.post("/orders", controller.createOrder);
router.patch("/orders/:id", controller.updateOrder);

module.exports = router;
