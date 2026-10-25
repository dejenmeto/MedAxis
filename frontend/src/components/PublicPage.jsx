import { Link } from "react-router-dom";
import {
  FiActivity,
  FiCalendar,
  FiHeart,
  FiShield,
  FiUsers,
} from "react-icons/fi";
import "./PublicPage.css";
// import About from "./About";
import Footer from "./Footer";
import About from "./About";
import Home from "./Home";
import Services from "./Services";
import Contact from "./Contact";

const services = [
  {
    icon: FiUsers,
    title: "Patient Management",
    description:
      "Organize patient registration, medical history, appointments and follow-up care.",
  },
  {
    icon: FiActivity,
    title: "Diagnostic Services",
    description:
      "Coordinate laboratory requests, diagnostic results and clinical workflows.",
  },
  {
    icon: FiHeart,
    title: "Clinical Records",
    description:
      "Support clinicians with structured encounters, diagnoses and treatment records.",
  },
  {
    icon: FiCalendar,
    title: "Appointment Scheduling",
    description:
      "Coordinate visits and help teams manage the daily patient schedule.",
  },
];

export default function PublicPage({ page = "home" }) {
  if (page === "about") {
    return (
      <PublicShell>
        {/* <section className="public-content-page">
          <span className="eyebrow">ABOUT MEDAXIS</span>
          <h1>Technology that supports better hospital operations.</h1>
          <p>
            MedAxis is a hospital management platform designed to bring
            administrative and clinical workflows into one organized system.
          </p>
          <p>
            Its modules are designed for controlled access, traceable changes
            and consistent patient information.
          </p>
          <About />
        </section> */}
        <About />
      </PublicShell>
    );
  }

  if (page === "contact") {
    return (
      <PublicShell>
        {/* <section className="public-content-page">
          <span className="eyebrow">CONTACT</span>
          <h1>Contact the MedAxis team</h1>
          <p>
            For deployment, training or support enquiries, contact your
            organization’s MedAxis system administrator.
          </p>
          <Link className="primary-button" to="/login">
            Sign in
          </Link>
        </section> */}
        <Contact />
      </PublicShell>
    );
  }

  if (page === "services") {
    return (
      <PublicShell>
        {/* <section className="public-content-page">
          <span className="eyebrow">OUR SERVICES</span>
          <h1>One platform for hospital workflows</h1>
          <div className="public-service-grid">
            {services.map(({ icon: Icon, title, description }) => (
              <article className="public-service-card" key={title}>
                <Icon size={24} />
                <h2>{title}</h2>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section> */}
        <Services />
      </PublicShell>
    );
  }

  if (page === "profile") {
    return (
      <PublicShell>
        <section className="public-content-page">
          <span className="eyebrow">YOUR ACCOUNT</span>
          <h1>Staff profile</h1>
          <p>Sign in to access your account and permitted hospital modules.</p>
          <Link className="primary-button" to="/login">
            Sign in
          </Link>
        </section>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      {/* <section className="public-hero">
        <div className="hero-copy">
          <span className="eyebrow">HOSPITAL MANAGEMENT PLATFORM</span>
          <h1>
            Connected hospital operations.
            <span> More organized patient care.</span>
          </h1>
          <p>
            Coordinate patient registration, clinical records, diagnostics,
            appointments and hospital administration in one system.
          </p>
          <div className="hero-actions">
            <Link to="/login" className="primary-button">
              Staff sign in
            </Link>
            <Link to="/services" className="secondary-button">
              Explore services
            </Link>
          </div>
          <div className="hero-assurance">
            <FiShield />
            <span>Role-based access and traceable workflows</span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-visual-header">
            <div>
              <span>MEDAXIS</span>
              <strong>Care operations</strong>
            </div>
            <div className="status-dot" />
          </div>
          <div className="hero-metric">
            <div className="metric-icon">
              <FiUsers />
            </div>
            <div>
              <span>Patient services</span>
              <strong>Connected workflows</strong>
            </div>
          </div>
          <div className="hero-metric">
            <div className="metric-icon">
              <FiCalendar />
            </div>
            <div>
              <span>Daily operations</span>
              <strong>Coordinated scheduling</strong>
            </div>
          </div>
          <div className="hero-metric">
            <div className="metric-icon">
              <FiHeart />
            </div>
            <div>
              <span>Clinical workspace</span>
              <strong>Structured patient records</strong>
            </div>
          </div>
          <p className="hero-visual-note">
            Sample interface illustration — not live hospital data.
          </p>
        </div>
      </section> */}
      <Home />
    </PublicShell>
  );
}

function PublicShell({ children }) {
  return (
    <div className="public-shell">
      <header className="public-header">
        <Link to="/" className="public-brand">
          <span className="public-brand-mark">
            <FiActivity />
          </span>
          <span>
            <strong>MedAxis</strong>
            <small>Hospital Management</small>
          </span>
        </Link>

        <nav className="public-navigation">
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
          <Link to="/services">Services</Link>
          <Link to="/contact">Contact</Link>
        </nav>

        <Link to="/login" className="public-login-link">
          Login
        </Link>
      </header>

      {children}

      {/* <footer className="public-footer">
        <Footer />
        <span>© {new Date().getFullYear()} MedAxis</span>
        <span>Hospital management and care coordination</span>
      </footer> */}
      <Footer />
    </div>
  );
}
