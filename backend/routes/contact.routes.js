const express = require("express");
const router = express.Router();

const contactController = require("../controllers/contact.controller");
const authenticate = require("../middlewares/authenticate");

// Public endpoint: no login required.
router.post("/", contactController.createMessage);

// All admin inbox routes require authentication.
router.get("/admin", authenticate, contactController.listMessages);

router.get("/admin/summary", authenticate, contactController.getSummary);

router.patch("/admin/:id", authenticate, contactController.updateMessage);

module.exports = router;
