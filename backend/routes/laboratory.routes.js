const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const lab = require("../controllers/laboratory.controller");

// All laboratory endpoints require a valid access token.
router.use(authenticate);

// Test catalogue
router.get("/catalog", lab.getCatalog);
router.post("/catalog", lab.createCatalogTest);
router.put("/catalog/:id", lab.updateCatalogTest);
router.patch("/catalog/:id/active", lab.setCatalogTestActive);

// Orders and results
router.get("/orders", lab.getOrders);
router.get("/orders/:id", lab.getOrderById);
router.post("/orders", lab.createOrder);
router.patch("/orders/:id/status", lab.updateOrderStatus);
router.patch("/orders/:id/items/:itemId/result", lab.saveResult);

module.exports = router;
