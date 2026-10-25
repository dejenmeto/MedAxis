import api from "./api";

const ROOT = "/blood-bank";

const bloodBankService = {
  getSummary() {
    return api.get(`${ROOT}/summary`);
  },

  getRecords(resource, params = {}) {
    return api.get(`${ROOT}/${resource}`, { params });
  },

  createRecord(resource, data) {
    return api.post(`${ROOT}/${resource}`, data);
  },

  updateRecord(resource, id, data) {
    return api.put(`${ROOT}/${resource}/${id}`, data);
  },

  deleteRecord(resource, id) {
    return api.delete(`${ROOT}/${resource}/${id}`);
  },

  issueUnit(data) {
    return api.post(`${ROOT}/issue`, data);
  },
};

export default bloodBankService;
