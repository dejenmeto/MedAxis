import {
  FiActivity,
  FiArrowRight,
  FiCalendar,
  FiCheckCircle,
  FiHeart,
  FiShield,
  FiUsers,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import "./Home.css";

const highlights = [
  {
    icon: FiHeart,
    title: "Patient-Centered Care",
    description: "Respect, compassion, and attention to each patient's needs.",
  },
  {
    icon: FiActivity,
    title: "Coordinated Healthcare",
    description:
      "Connected hospital workflows that support better coordination.",
  },
  {
    icon: FiShield,
    title: "Privacy and Responsibility",
    description: "A commitment to handling patient information responsibly.",
  },
];

const serviceHighlights = [
  {
    number: "01",
    title: "Outpatient Care",
    description:
      "Support for consultations, appointments, and patient care coordination.",
  },
  {
    number: "02",
    title: "Laboratory Services",
    description:
      "Organized laboratory workflows to support diagnostic services.",
  },
  {
    number: "03",
    title: "Radiology and Imaging",
    description: "Support for imaging requests, reporting, and coordination.",
  },
  {
    number: "04",
    title: "Pharmacy Services",
    description:
      "Medication and pharmacy workflow management to support patient care.",
  },
];

function Home() {
  return (
    <div className="medaxis-home">
      <section className="home-hero">
        <div className="home-container home-hero-grid">
          <div className="home-hero-content">
            <span className="home-eyebrow">
              <span className="home-eyebrow-dot" />
              MEDAXIS HOSPITAL
            </span>

            <h1>
              Healthcare built around
              <span> people and compassion.</span>
            </h1>

            <p className="home-hero-description">
              We believe healthcare should be respectful, coordinated, and
              centered on the people who need it. MedAxis brings a
              patient-focused approach together with organized hospital services
              and modern healthcare technology.
            </p>

            <div className="home-hero-actions">
              <Link to="/services" className="home-button-primary">
                Explore Our Services <FiArrowRight />
              </Link>

              <Link to="/contact" className="home-button-secondary">
                Contact Us
              </Link>
            </div>

            <div className="home-hero-note">
              <FiCheckCircle />
              <span>Care, dignity, and responsible service.</span>
            </div>
          </div>

          <div className="home-hero-visual" aria-hidden="true">
            <div className="home-visual-circle home-visual-circle-back" />

            <div className="home-medical-symbol">
              <FiActivity />
            </div>

            <div className="home-visual-card home-visual-card-top">
              <span className="home-visual-card-icon">
                <FiHeart />
              </span>
              <span>
                <strong>People first</strong>
                <small>Compassionate care</small>
              </span>
            </div>

            <div className="home-visual-card home-visual-card-bottom">
              <span className="home-visual-card-icon">
                <FiShield />
              </span>
              <span>
                <strong>Responsible care</strong>
                <small>Trust and privacy</small>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="home-highlights">
        <div className="home-container home-highlights-grid">
          {highlights.map((item) => {
            const Icon = item.icon;

            return (
              <article className="home-highlight-card" key={item.title}>
                <div className="home-highlight-icon">
                  <Icon />
                </div>

                <div>
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="home-intro">
        <div className="home-container home-intro-grid">
          <div className="home-intro-panel">
            <div className="home-intro-panel-icon">
              <FiActivity />
            </div>
            <span>THE MEDAXIS APPROACH</span>
            <h2>Connecting care with better coordination.</h2>
            <p>
              Healthcare depends on people, teamwork, information, and reliable
              processes working together.
            </p>
          </div>

          <div className="home-intro-content">
            <span className="home-section-label">WELCOME TO MEDAXIS</span>

            <h2>
              More than hospital management.
              <span> A commitment to better care.</span>
            </h2>

            <p>
              MedAxis is designed to support the connected activities of a
              modern hospital, from patient registration and appointments to
              diagnostics, pharmacy, billing, and clinical coordination.
            </p>

            <p>
              Our approach emphasizes respectful service, effective teamwork,
              responsible information management, and continuous improvement.
            </p>

            <Link to="/about" className="home-text-link">
              Learn About MedAxis <FiArrowRight />
            </Link>
          </div>
        </div>
      </section>

      <section className="home-services">
        <div className="home-container">
          <div className="home-section-heading">
            <span className="home-section-label">HEALTHCARE SERVICES</span>
            <h2>Supporting the patient journey</h2>
            <p>
              Explore the service areas represented in the MedAxis hospital
              management platform.
            </p>
          </div>

          <div className="home-services-grid">
            {serviceHighlights.map((service) => (
              <article className="home-service-card" key={service.number}>
                <span className="home-service-number">{service.number}</span>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <Link to="/services" aria-label={`Explore ${service.title}`}>
                  Learn more <FiArrowRight />
                </Link>
              </article>
            ))}
          </div>

          <div className="home-services-action">
            <Link to="/services" className="home-button-outline">
              View All Services <FiArrowRight />
            </Link>
          </div>
        </div>
      </section>

      <section className="home-commitment">
        <div className="home-container home-commitment-grid">
          <div>
            <span className="home-section-label">OUR COMMITMENT</span>
            <h2>Every person deserves care with dignity.</h2>
            <p>
              We believe that listening, respect, clear communication, and
              responsible healthcare practices are essential parts of a positive
              patient experience.
            </p>
          </div>

          <div className="home-commitment-points">
            <div>
              <FiCheckCircle />
              <span>Respect for every patient</span>
            </div>
            <div>
              <FiCheckCircle />
              <span>Teamwork across hospital services</span>
            </div>
            <div>
              <FiCheckCircle />
              <span>Responsible use of healthcare information</span>
            </div>
            <div>
              <FiCheckCircle />
              <span>Continuous improvement and learning</span>
            </div>
          </div>
        </div>
      </section>

      <section className="home-cta">
        <div className="home-container home-cta-inner">
          <div className="home-cta-icon">
            <FiUsers />
          </div>

          <div className="home-cta-copy">
            <h2>How can we help you?</h2>
            <p>
              Contact MedAxis for information about services, patient support,
              or general inquiries.
            </p>
          </div>

          <Link to="/contact" className="home-button-primary">
            Get in Touch <FiArrowRight />
          </Link>
        </div>
      </section>
    </div>
  );
}

export default Home;
