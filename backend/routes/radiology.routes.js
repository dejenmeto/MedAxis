const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const radiology = require("../controllers/radiology.controller");

// All Radiology endpoints require a valid access token.
router.use(authenticate);

// Imaging services catalogue
router.get("/services", radiology.getServices);
router.post("/services", radiology.createService);
router.put("/services/:id", radiology.updateService);
router.patch("/services/:id/active", radiology.setServiceActive);

// Imaging orders
router.get("/orders", radiology.getOrders);
router.get("/orders/:id", radiology.getOrderById);
router.post("/orders", radiology.createOrder);
router.patch("/orders/:id/status", radiology.updateOrderStatus);

// Imaging reports
router.put("/orders/:id/report", radiology.saveReport);

module.exports = router;
