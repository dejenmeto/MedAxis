import api from "./api";

const emrService = {
  async list(params = {}) {
    const response = await api.get("/emr/encounters", { params });
    return response.data;
  },

  async getById(id) {
    const response = await api.get(`/emr/encounters/${id}`);
    return response.data;
  },

  async createEncounter(payload) {
    const response = await api.post("/emr/encounters", payload);
    return response.data;
  },

  async updateEncounter(id, payload) {
    const response = await api.patch(`/emr/encounters/${id}`, payload);
    return response.data;
  },

  async addDiagnosis(encounterId, payload) {
    const response = await api.post(
      `/emr/encounters/${encounterId}/diagnoses`,
      payload,
    );
    return response.data;
  },

  async addVitalSigns(encounterId, payload) {
    const response = await api.post(
      `/emr/encounters/${encounterId}/vitals`,
      payload,
    );
    return response.data;
  },
};

export default emrService;
