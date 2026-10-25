import api from "./api";

const patientPortalService = {
  getDashboard() {
    return api.get("/patient-portal/dashboard");
  },

  getAppointments(patientId) {
    return api.get(`/patient-portal/patients/${patientId}/appointments`);
  },

  getDocuments(patientId) {
    return api.get(`/patient-portal/patients/${patientId}/documents`);
  },

  getReports(patientId) {
    return api.get(`/patient-portal/patients/${patientId}/reports`);
  },

  getInvoices(patientId) {
    return api.get(`/patient-portal/patients/${patientId}/invoices`);
  },

  getPayments(patientId) {
    return api.get(`/patient-portal/patients/${patientId}/payments`);
  },

  getAccessLinks() {
    return api.get("/patient-portal/admin/access");
  },

  createAccessLink(data) {
    return api.post("/patient-portal/admin/access", data);
  },

  updateAccessStatus(id, status) {
    return api.patch(`/patient-portal/admin/access/${id}`, { status });
  },
};

export default patientPortalService;
