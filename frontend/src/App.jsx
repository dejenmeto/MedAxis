import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/layouts/AppLayout";
import PublicPage from "./components/PublicPage";
// import About from "./components/About";
import Login from "./pages/auth/Login";
import Dashboard from "./pages/dashboard/Dashboard";
import Patients from "./pages/patients/Patients";
import Appointments from "./pages/appointments/Appointments";
import EMR from "./pages/emr/EMR";
import Laboratory from "./pages/laboratory/Laboratory";
import Pharmacy from "./pages/pharmacy/Pharmacy";
import Billing from "./pages/billing/Billing";
import Departments from "./pages/departments/Departments";
import Staff from "./pages/staff/Staff";
import UserManagement from "./pages/administration/UserManagement";
import InpatientManagement from "./pages/inpatient/Inpatient";
import Radiology from "./pages/radiology/Radiology";
import Nursing from "./pages/nursing/Nursing";
import Theatre from "./pages/theatre/Theatre";
import InventoryProcurement from "./pages/inventory/InventoryProcurement";
import ICU from "./pages/icu/ICU";
import Maternity from "./pages/maternity/Maternity";
import BloodBank from "./pages/bloodBank/BloodBank";
import Insurance from "./pages/insurance/Insurance";
import Payroll from "./pages/payroll/Payroll";
import AuditCompliance from "./pages/auditCompliance/AuditCompliance";
import Reports from "./pages/reports/Reports";
import Settings from "./pages/settings/Settings";
import Queue from "./pages/queue/Queue";
import Notifications from "./pages/notifications/Notifications";
import Ambulance from "./pages/ambulance/Ambulance";
import Telemedicine from "./pages/telemedicine/Telemedicine";
import Documents from "./pages/documents/Documents";
import MedicalReports from "./pages/medicalReports/MedicalReports";
import SlotAvailability from "./pages/slotAvailability/SlotAvailability";
import Calendar from "./pages/calendar/Calendar";
import EquipmentMaintenance from "./pages/equipment-maintenance/EquipmentMaintenance";
import InfectionControl from "./pages/infection-control/InfectionControl";
import PatientFeedback from "./pages/patient-feedback/PatientFeedback";

import PatientPortal from "./pages/patientPortal/PatientPortal";
import PatientPortalAccess from "./pages/patientPortal/PatientPortalAccess";

import Communications from "./pages/communications/Communications";
import Payments from "./pages/payments/Payments";

import DoctorWorkspace from "./pages/doctor-workspace/DoctorWorkspace";
import ContactMessages from "./pages/admin/ContactMessages";

const ADMIN_ROLES = ["super_admin", "hospital_admin"];

export default function App() {
  return (
    <Routes>
      {/* Public pages */}

      <Route path="/" element={<PublicPage page="home" />} />
      <Route path="/about" element={<PublicPage page="about" />} />

      <Route path="/services" element={<PublicPage page="services" />} />
      <Route path="/contact" element={<PublicPage page="contact" />} />
      <Route path="/profile" element={<PublicPage page="profile" />} />
      <Route path="/login" element={<Login />} />

      {/* Pages available to authenticated users */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/patients" element={<Patients />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/emr" element={<EMR />} />
          <Route path="/laboratory" element={<Laboratory />} />
          <Route path="/pharmacy" element={<Pharmacy />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/inpatient" element={<InpatientManagement />} />
          <Route path="/radiology" element={<Radiology />} />
          <Route path="/nursing" element={<Nursing />} />
          <Route path="/theatre" element={<Theatre />} />
          <Route path="/inventory" element={<InventoryProcurement />} />
          <Route path="/icu" element={<ICU />} />
          <Route path="/maternity" element={<Maternity />} />
          <Route path="/blood-bank" element={<BloodBank />} />
          <Route path="/insurance" element={<Insurance />} />
          <Route path="/payroll" element={<Payroll />} />
          <Route path="/audit-compliance" element={<AuditCompliance />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/ambulance" element={<Ambulance />} />
          <Route path="/telemedicine" element={<Telemedicine />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/medical-reports" element={<MedicalReports />} />
          <Route path="/slot-availability" element={<SlotAvailability />} />
          <Route path="/calendar" element={<Calendar />} />

          <Route path="/patient-portal" element={<PatientPortal />} />
          <Route path="/admin/contact-messages" element={<ContactMessages />} />

          <Route
            path="/patient-portal/access"
            element={<PatientPortalAccess />}
          />

          <Route path="/communications" element={<Communications />} />

          <Route path="/doctor-workspace" element={<DoctorWorkspace />} />
          <Route path="/payments" element={<Payments />} />
          <Route
            path="/equipment-maintenance"
            element={<EquipmentMaintenance />}
          />
          <Route path="/patient-feedback" element={<PatientFeedback />} />
          <Route path="/infection-control" element={<InfectionControl />} />

          {/* Admin-only pages */}
          <Route element={<ProtectedRoute allowedRoles={ADMIN_ROLES} />}>
            <Route path="/departments" element={<Departments />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/administration" element={<UserManagement />} />
          </Route>
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
