import { Link } from "react-router-dom";
import {
  FiActivity,
  FiArrowUpRight,
  FiClock,
  FiHeart,
  FiMail,
  FiMapPin,
  FiPhone,
  FiShield,
} from "react-icons/fi";
import "./Footer.css";

const quickLinks = [
  { label: "Home", path: "/" },
  { label: "About Us", path: "/about" },
  { label: "Our Services", path: "/services" },
  { label: "Contact Us", path: "/contact" },
  { label: "My Profile", path: "/profile" },
];

const medicalServices = [
  "Outpatient Care",
  "Laboratory Services",
  "Radiology & Imaging",
  "Pharmacy Services",
  "Emergency Care",
];

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="medaxis-footer">
      <div className="medaxis-footer-container">
        <div className="medaxis-footer-main">
          {/* Hospital identity */}
          <div className="medaxis-footer-brand">
            <Link
              to="/"
              className="medaxis-footer-logo"
              aria-label="MedAxis Hospital home"
            >
              <span className="medaxis-footer-logo-icon">
                <FiActivity />
              </span>

              <span>
                <span className="medaxis-footer-brand-name">MedAxis</span>
                <span className="medaxis-footer-brand-subtitle">
                  HOSPITAL & HEALTHCARE
                </span>
              </span>
            </Link>

            <p className="medaxis-footer-description">
              Your health matters. MedAxis is committed to supporting better
              healthcare through compassionate service, professional care, and
              modern medical technology.
            </p>

            <div className="medaxis-footer-trust">
              <FiHeart aria-hidden="true" />
              <span>Care, compassion, and commitment.</span>
            </div>
          </div>

          {/* Quick navigation */}
          <div className="medaxis-footer-column">
            <h3>Quick Links</h3>

            <ul>
              {quickLinks.map((item) => (
                <li key={item.path}>
                  <Link to={item.path}>
                    <FiArrowUpRight aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div className="medaxis-footer-column">
            <h3>Our Services</h3>

            <ul>
              {medicalServices.map((service) => (
                <li key={service}>
                  <Link to="/services">
                    <FiArrowUpRight aria-hidden="true" />
                    {service}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact and support */}
          <div className="medaxis-footer-column medaxis-footer-contact">
            <h3>Contact & Support</h3>

            <p className="medaxis-footer-contact-intro">
              Need assistance? Contact our hospital team for information about
              our services and patient support.
            </p>

            <Link to="/contact" className="medaxis-footer-contact-item">
              <FiMapPin aria-hidden="true" />
              <span>Hospital location and directions</span>
            </Link>

            <Link to="/contact" className="medaxis-footer-contact-item">
              <FiPhone aria-hidden="true" />
              <span>Contact our hospital team</span>
            </Link>

            <Link to="/contact" className="medaxis-footer-contact-item">
              <FiMail aria-hidden="true" />
              <span>Send us a message</span>
            </Link>

            <div className="medaxis-footer-contact-item">
              <FiClock aria-hidden="true" />
              <span>
                <strong>Emergency services</strong>
                <small>
                  Contact the hospital for emergency assistance details.
                </small>
              </span>
            </div>
          </div>
        </div>

        {/* Patient information strip */}
        <div className="medaxis-footer-patient-strip">
          <div className="medaxis-footer-patient-icon">
            <FiShield aria-hidden="true" />
          </div>

          <div className="medaxis-footer-patient-text">
            <strong>Your privacy matters</strong>
            <p>
              Patient information should be handled with care and protected
              according to applicable privacy requirements.
            </p>
          </div>

          <Link to="/contact" className="medaxis-footer-support-link">
            Get Support <FiArrowUpRight aria-hidden="true" />
          </Link>
        </div>

        {/* Copyright and legal links */}
        <div className="medaxis-footer-bottom">
          <p>© {currentYear} MedAxis Hospital. All rights reserved.</p>

          <div className="medaxis-footer-legal">
            <Link to="/contact">Privacy & Support</Link>
            <span className="medaxis-footer-divider">|</span>
            <Link to="/about">About MedAxis</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
