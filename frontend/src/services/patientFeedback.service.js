import api from "./api";

const base = "/patient-feedback";

const unwrap = (response) => response.data;

const patientFeedbackService = {
  getFeedback: (params = {}) => api.get(base, { params }).then(unwrap),

  createFeedback: (payload) => api.post(base, payload).then(unwrap),

  updateFeedback: (id, payload) =>
    api.patch(`${base}/${id}`, payload).then(unwrap),

  getNotes: (id) => api.get(`${base}/${id}/notes`).then(unwrap),

  createNote: (id, payload) =>
    api.post(`${base}/${id}/notes`, payload).then(unwrap),
};

export default patientFeedbackService;
