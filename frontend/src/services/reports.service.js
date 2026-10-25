import api from "./api";

const ROOT = "/reports";

const reportConfig = {
  headers: {
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  },
};

const reportsService = {
  getSummary: (params = {}) =>
    api.get(`${ROOT}/summary`, { ...reportConfig, params }),

  getMonthly: (params = {}) =>
    api.get(`${ROOT}/monthly`, { ...reportConfig, params }),

  getFinancial: (params = {}) =>
    api.get(`${ROOT}/financial`, { ...reportConfig, params }),
};

export default reportsService;
