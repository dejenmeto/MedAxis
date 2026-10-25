const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const notificationsController = require("../controllers/notifications.controller");

router.use(authenticate);

// Every authenticated user can manage only their own notifications.
router.get("/", notificationsController.listNotifications);
router.get("/unread-count", notificationsController.getUnreadCount);

// Keep this route above "/:id" routes.
router.patch("/read-all", notificationsController.markAllAsRead);

router.post("/", notificationsController.createNotification);

router.patch("/:id/read", notificationsController.markAsRead);
router.patch("/:id/archive", notificationsController.archiveNotification);
router.delete("/:id", notificationsController.deleteNotification);

module.exports = router;
