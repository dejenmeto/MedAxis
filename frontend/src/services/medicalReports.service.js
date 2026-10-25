import api from "./api";

const medicalReportsService = {
  getReports(params = {}) {
    return api.get("/medical-reports", { params });
  },

  getReport(id) {
    return api.get(`/medical-reports/${id}`);
  },

  createReport(payload) {
    return api.post("/medical-reports", payload);
  },

  updateReport(id, payload) {
    return api.patch(`/medical-reports/${id}`, payload);
  },

  finalizeReport(id) {
    return api.patch(`/medical-reports/${id}/finalize`);
  },

  archiveReport(id) {
    return api.patch(`/medical-reports/${id}/archive`);
  },
};

export default medicalReportsService;
