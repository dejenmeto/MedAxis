import api from "./api";

const base = "/infection-control";

const infectionControlService = {
  getCases: (params = {}) =>
    api.get(`${base}/cases`, { params }).then((response) => response.data),

  createCase: (payload) =>
    api.post(`${base}/cases`, payload).then((response) => response.data),

  updateCase: (id, payload) =>
    api.patch(`${base}/cases/${id}`, payload).then((response) => response.data),

  getActions: (params = {}) =>
    api.get(`${base}/actions`, { params }).then((response) => response.data),

  createAction: (payload) =>
    api.post(`${base}/actions`, payload).then((response) => response.data),

  updateAction: (id, payload) =>
    api
      .patch(`${base}/actions/${id}`, payload)
      .then((response) => response.data),
};

export default infectionControlService;
