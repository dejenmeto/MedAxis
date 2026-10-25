import api from "./api";

const paymentsService = {
  getAll(params = {}) {
    return api.get("/payments", { params });
  },

  create(data) {
    return api.post("/payments", data);
  },

  verify(reference) {
    return api.post(`/payments/${encodeURIComponent(reference)}/verify`);
  },

  simulateResult(reference, outcome) {
    return api.post(`/payments/${encodeURIComponent(reference)}/test-result`, {
      outcome,
    });
  },
};

export default paymentsService;
