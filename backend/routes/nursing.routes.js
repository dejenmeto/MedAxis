const express = require("express");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const controller = require("../controllers/nursing.controller");

const router = express.Router();

router.use(authenticate);

// Roles permitted to work with Nursing records.
// Confirm these role names match the existing authorization middleware.
const nursingRoles = ["super_admin", "hospital_admin", "doctor", "nurse"];

router.use(authorize(...nursingRoles));

function registerResource(path, handlers) {
  router.get(`/${path}`, handlers.list);
  router.get(`/${path}/:id`, handlers.getOne);
  router.post(`/${path}`, handlers.create);
  router.put(`/${path}/:id`, handlers.update);
  router.delete(`/${path}/:id`, handlers.remove);
}

registerResource("assessments", controller.assessments);
registerResource("care-plans", controller.carePlans);
registerResource("observations", controller.observations);

module.exports = router;
