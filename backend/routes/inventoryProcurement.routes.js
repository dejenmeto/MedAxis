const express = require("express");
const authenticate = require("../middlewares/authenticate");
const controller = require("../controllers/inventoryProcurement.controller");

const router = express.Router();

// Every route in this module requires a valid access token.
router.use(authenticate);

// Dashboard
router.get("/summary", controller.getSummary);

// Inventory categories
router.get("/categories", controller.listCategories);
router.post("/categories", controller.createCategory);
router.put("/categories/:id", controller.updateCategory);

// Inventory items
router.get("/items", controller.listItems);
router.post("/items", controller.createItem);
router.put("/items/:id", controller.updateItem);
router.delete("/items/:id", controller.deactivateItem);

// Suppliers
router.get("/suppliers", controller.listSuppliers);
router.post("/suppliers", controller.createSupplier);
router.put("/suppliers/:id", controller.updateSupplier);

// Stock transactions and reports
router.get("/transactions", controller.listStockTransactions);
router.post("/transactions", controller.createStockTransaction);
router.get("/reports/low-stock", controller.getLowStock);
router.get("/reports/expiring", controller.getExpiringItems);

// Procurement
router.get("/procurement/orders", controller.listPurchaseOrders);
router.post("/procurement/orders", controller.createPurchaseOrder);
router.patch(
  "/procurement/orders/:id/status",
  controller.updatePurchaseOrderStatus,
);

// Receiving
router.post(
  "/procurement/orders/:id/receipts",
  controller.receivePurchaseOrder,
);

module.exports = router;
