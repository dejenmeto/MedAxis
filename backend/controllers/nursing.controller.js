const nursingService = require("../services/nursing.service");

function getHospitalId(req) {
  const hospitalId = req.user?.hospitalId ?? req.user?.hospital_id;

  if (!hospitalId) {
    const error = new Error("Your account is not linked to a hospital.");
    error.statusCode = 403;
    throw error;
  }

  return hospitalId;
}

function getActorStaffId(req) {
  return (
    req.user?.staffProfileId ??
    req.user?.staff_profile_id ??
    req.user?.staffId ??
    req.user?.staff_id ??
    null
  );
}

function sendError(res, error) {
  console.error("[Nursing API Error]", error);

  const status = error.statusCode || 500;
  return res.status(status).json({
    success: false,
    message:
      status === 500
        ? "An unexpected Nursing module error occurred."
        : error.message,
  });
}

function makeController(resourceName) {
  return {
    list: async (req, res) => {
      try {
        const result = await nursingService.list(
          resourceName,
          getHospitalId(req),
          {
            page: req.query.page,
            limit: req.query.limit,
            search: req.query.search,
            patientId: req.query.patientId || req.query.patient_id,
          },
        );

        return res.json({
          success: true,
          ...result,
        });
      } catch (error) {
        return sendError(res, error);
      }
    },

    getOne: async (req, res) => {
      try {
        const record = await nursingService.getById(
          resourceName,
          getHospitalId(req),
          req.params.id,
        );

        if (!record) {
          return res.status(404).json({
            success: false,
            message: "Nursing record not found.",
          });
        }

        return res.json({ success: true, data: record });
      } catch (error) {
        return sendError(res, error);
      }
    },

    create: async (req, res) => {
      try {
        const record = await nursingService.create(
          resourceName,
          getHospitalId(req),
          req.body,
          getActorStaffId(req),
        );

        return res.status(201).json({
          success: true,
          message: "Nursing record created successfully.",
          data: record,
        });
      } catch (error) {
        return sendError(res, error);
      }
    },

    update: async (req, res) => {
      try {
        const record = await nursingService.update(
          resourceName,
          getHospitalId(req),
          req.params.id,
          req.body,
        );

        return res.json({
          success: true,
          message: "Nursing record updated successfully.",
          data: record,
        });
      } catch (error) {
        return sendError(res, error);
      }
    },

    remove: async (req, res) => {
      try {
        const record = await nursingService.remove(
          resourceName,
          getHospitalId(req),
          req.params.id,
        );

        if (!record) {
          return res.status(404).json({
            success: false,
            message: "Nursing record not found.",
          });
        }

        return res.json({
          success: true,
          message: "Nursing record deleted successfully.",
          data: record,
        });
      } catch (error) {
        return sendError(res, error);
      }
    },
  };
}

module.exports = {
  assessments: makeController("assessments"),
  carePlans: makeController("carePlans"),
  observations: makeController("observations"),
};
