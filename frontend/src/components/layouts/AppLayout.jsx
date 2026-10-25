import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  FiActivity,
  FiShield,
  FiCalendar,
  FiClipboard,
  FiCreditCard,
  FiGrid,
  FiTool,
  FiHeart,
  FiLogOut,
  FiMenu,
  FiPackage,
  FiSettings,
  FiUsers,
  FiUserPlus,
  FiBarChart2,
  FiX,
  FiFileText,
  FiVideo,
  FiBell,
  FiDollarSign,
  FiDroplet,
  FiImage,
  FiClock,
  FiTruck,
  FiMail,
  FiMessageSquare,
} from "react-icons/fi";

import "./AppLayout.css";

const navigation = [
  { label: "Dashboard", path: "/dashboard", icon: FiGrid, roles: [] },
  { label: "Patients", path: "/patients", icon: FiUsers, roles: [] },
  { label: "Appointments", path: "/appointments", icon: FiCalendar, roles: [] },
  { label: "Medical Records", path: "/emr", icon: FiHeart, roles: [] },
  { label: "Laboratory", path: "/laboratory", icon: FiActivity, roles: [] },
  { label: "Pharmacy", path: "/pharmacy", icon: FiPackage, roles: [] },
  { label: "Billing", path: "/billing", icon: FiCreditCard, roles: [] },
  { label: "Operating Theatre", path: "/theatre", icon: FiActivity, roles: [] },
  {
    label: "Contact Messages",
    path: "/admin/contact-messages",
    icon: FiMail,
    roles: ["super_admin", "hospital_admin"],
  },

  {
    label: "Doctor Workspace",
    path: "/doctor-workspace",
    icon: FiActivity,
    roles: ["super_admin", "hospital_admin", "doctor"],
  },
  {
    label: "Payment Integration",
    path: "/payments",
    icon: FiCreditCard,
    roles: ["super_admin", "hospital_admin", "accountant"],
  },
  {
    label: "Email & SMS Services",
    path: "/communications",
    icon: FiMessageSquare,
    roles: ["super_admin", "hospital_admin"],
  },

  {
    label: "Patient & Guardian Portal",
    path: "/patient-portal",
    icon: FiUsers,
    roles: ["patient", "guardian"],
  },
  {
    label: "Patient Portal Access",
    path: "/patient-portal/access",
    icon: FiShield,
    roles: ["super_admin", "hospital_admin"],
  },

  {
    label: "Equipment & Maintenance",
    path: "/equipment-maintenance",
    icon: FiTool,
    roles: [
      "super_admin",
      "hospital_admin",
      "doctor",
      "nurse",
      "receptionist",
      "lab_technician",
      "radiologist",
      "pharmacist",
    ],
  },
  {
    label: "Infection Prevention",
    path: "/infection-control",
    icon: FiShield,
    roles: [
      "super_admin",
      "hospital_admin",
      "doctor",
      "nurse",
      "lab_technician",
    ],
  },
  {
    label: "Patient Feedback",
    path: "/patient-feedback",
    icon: FiMessageSquare,
    roles: ["super_admin", "hospital_admin", "receptionist", "nurse"],
  },
  {
    label: "Hospital Calendar",
    path: "/calendar",
    icon: FiCalendar,
    roles: [
      "super_admin",
      "hospital_admin",
      "doctor",
      "nurse",
      "receptionist",
      "lab_technician",
      "radiologist",
      "pharmacist",
      "accountant",
    ],
  },
  {
    label: "Medical Documents",
    path: "/documents",
    icon: FiFileText,
    roles: [
      "super_admin",
      "hospital_admin",
      "doctor",
      "nurse",
      "receptionist",
      "lab_technician",
      "radiologist",
      "pharmacist",
      "accountant",
    ],
  },
  {
    label: "Notifications",
    path: "/notifications",
    icon: FiBell,
  },
  {
    label: "Queue & Patient Flow",
    path: "/queue",
    icon: FiUsers,
    roles: [
      "super_admin",
      "hospital_admin",
      "doctor",
      "nurse",
      "receptionist",
      "lab_technician",
      "radiologist",
    ],
  },

  {
    label: "Audit & Compliance",
    path: "/audit-compliance",
    icon: FiShield,
    roles: ["super_admin", "hospital_admin", "accountant"],
  },
  {
    label: "Payroll",
    path: "/payroll",
    icon: FiDollarSign,
    roles: ["super_admin", "hospital_admin", "accountant"],
  },
  {
    label: "Insurance & Claims",
    path: "/insurance",
    icon: FiShield,
    roles: ["super_admin", "hospital_admin", "accountant", "receptionist"],
  },
  {
    label: "Maternity & Women's Health",
    path: "/maternity",
    icon: FiHeart,
    roles: [],
  },
  { label: "Blood Bank", path: "/blood-bank", icon: FiDroplet, roles: [] },
  {
    label: "Inventory & Procurement",
    path: "/inventory",
    icon: FiPackage,
    roles: ["super_admin", "hospital_admin", "pharmacist"],
  },
  {
    label: "Inpatient & Beds",
    path: "/inpatient",
    icon: FiClipboard,
    roles: [],
  },
  {
    label: "Medical Reports",
    path: "/medical-reports",
    icon: FiFileText,
    roles: [
      "super_admin",
      "hospital_admin",
      "doctor",
      "nurse",
      "receptionist",
      "lab_technician",
      "radiologist",
      "pharmacist",
      "accountant",
    ],
  },

  {
    label: "Staff",
    path: "/staff",
    icon: FiUserPlus,
    roles: ["super_admin", "hospital_admin"],
  },
  {
    label: "ICU & Critical Care",
    path: "/icu",
    icon: FiActivity,
    roles: ["super_admin", "hospital_admin", "doctor", "nurse"],
  },
  {
    label: "Reports & Analytics",
    path: "/reports",
    icon: FiBarChart2,
    roles: ["super_admin", "hospital_admin", "accountant"],
  },
  {
    label: "Radiology",
    path: "/radiology",
    icon: FiImage,
    roles: [],
  },
  {
    label: "Slot Availability",
    path: "/slot-availability",
    icon: FiClock,
    roles: ["super_admin", "hospital_admin", "receptionist", "doctor", "nurse"],
  },

  { label: "Nursing", path: "/nursing", icon: FiClipboard, roles: [] },
  {
    label: "Administration",
    path: "/administration",
    icon: FiSettings,
    roles: ["super_admin", "hospital_admin"],
  },
  {
    label: "Telemedicine",
    path: "/telemedicine",
    icon: FiVideo,
    roles: ["super_admin", "hospital_admin", "doctor", "nurse", "receptionist"],
  },
  {
    label: "Ambulance & Emergency",
    path: "/ambulance",
    icon: FiTruck,
    roles: ["super_admin", "hospital_admin", "doctor", "nurse", "receptionist"],
  },
  {
    label: "Settings",
    path: "/settings",
    icon: FiSettings,
    roles: ["super_admin", "hospital_admin"],
  },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const visibleNavigation = navigation.filter((item) => {
    const roles = item.roles ?? [];

    return roles.length === 0 || roles.includes(user?.role);
  });

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`app-sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-symbol">
            <FiDroplet size={23} />
          </div>
          <div>
            <strong>MedAxis</strong>
            <span>Hospital System</span>
          </div>
          <button
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <FiX />
          </button>
        </div>

        <div className="sidebar-section-label">WORKSPACE</div>

        <nav className="sidebar-navigation">
          {visibleNavigation.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "sidebar-link-active" : ""}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user-avatar">
            {(user?.first_name || user?.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-user-details">
            <strong>
              {[user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
                user?.email ||
                "Staff member"}
            </strong>
            <span>{String(user?.role || "user").replaceAll("_", " ")}</span>
          </div>
          <button
            className="icon-button logout-button"
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
          >
            <FiLogOut />
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <button
            className="icon-button mobile-menu-button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <FiMenu size={21} />
          </button>

          <div className="topbar-heading">
            <strong>MedAxis Workspace</strong>
            <span>Hospital operations and patient care</span>
          </div>

          <div className="topbar-user">
            <span>{user?.email}</span>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
