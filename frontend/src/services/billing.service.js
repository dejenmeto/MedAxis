import api from "./api";

const billingService = {
  async listInvoices(params = {}) {
    const response = await api.get("/billing/invoices", { params });
    return response.data;
  },

  async getInvoice(id) {
    const response = await api.get(`/billing/invoices/${id}`);
    return response.data;
  },

  async createInvoice(payload) {
    const response = await api.post("/billing/invoices", payload);
    return response.data;
  },

  async issueInvoice(id) {
    const response = await api.patch(`/billing/invoices/${id}/issue`);
    return response.data;
  },

  async voidInvoice(id) {
    const response = await api.post(`/billing/invoices/${id}/void`);
    return response.data;
  },

  async recordPayment(invoiceId, payload) {
    const response = await api.post(
      `/billing/invoices/${invoiceId}/payments`,
      payload,
    );
    return response.data;
  },

  async listInvoicePayments(invoiceId) {
    const response = await api.get(`/billing/invoices/${invoiceId}/payments`);
    return response.data;
  },

  async listPayments(params = {}) {
    const response = await api.get("/billing/payments", { params });
    return response.data;
  },
};

export default billingService;
