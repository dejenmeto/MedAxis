const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const payments = require("../controllers/payments.controller");

router.use(authenticate);

router.get("/", payments.listPayments);
router.post("/", payments.createPayment);
router.post("/:reference/verify", payments.verifyPayment);
router.post("/:reference/test-result", payments.simulateTestPayment);

module.exports = router;
