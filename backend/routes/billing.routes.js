const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const billing = require("../controllers/billing.controller");

router.use(authenticate);

router.get("/invoices", billing.listInvoices);
router.post("/invoices", billing.createInvoice);
router.get("/invoices/:id", billing.readInvoice);
router.patch("/invoices/:id", billing.updateDraftInvoice);
router.patch("/invoices/:id/issue", billing.issueInvoice);
router.post("/invoices/:id/void", billing.voidInvoice);
router.get("/invoices/:id/payments", billing.listInvoicePayments);
router.post("/invoices/:id/payments", billing.recordPayment);
router.get("/payments", billing.listPayments);

module.exports = router;
