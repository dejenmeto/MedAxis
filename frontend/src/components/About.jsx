import {
  FiActivity,
  FiHeart,
  FiShield,
  FiUsers,
  FiTarget,
  FiEye,
  FiCheckCircle,
  FiArrowRight,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import "./About.css";

const coreValues = [
  {
    icon: FiHeart,
    title: "Compassion",
    description:
      "We believe every patient deserves kindness, respect, dignity, and understanding throughout their healthcare journey.",
  },
  {
    icon: FiShield,
    title: "Trust and Safety",
    description:
      "We value patient privacy, responsible healthcare practices, and a safe environment for patients and healthcare professionals.",
  },
  {
    icon: FiUsers,
    title: "Patient-Centered Care",
    description:
      "We put patients first by supporting clear communication, respectful treatment, and care that considers individual needs.",
  },
  {
    icon: FiActivity,
    title: "Continuous Improvement",
    description:
      "We embrace learning, teamwork, and appropriate medical technology to support better healthcare services.",
  },
];

const careServices = [
  "Outpatient and consultation services",
  "Laboratory testing and diagnostics",
  "Radiology and medical imaging",
  "Pharmacy and medication services",
  "Inpatient and nursing care",
  "Emergency and critical care support",
];

function About() {
  return (
    <div className="medaxis-about">
      {/* Hero section */}
      <section className="about-hero">
        <div className="about-container about-hero-content">
          <div className="about-eyebrow">
            <span className="about-eyebrow-line" />
            GET TO KNOW US
          </div>

          <h1>
            About <span>MedAxis Hospital</span>
          </h1>

          <p className="about-hero-description">
            Healthcare with compassion. Service with integrity. A commitment to
            putting people first.
          </p>

          <p className="about-hero-secondary">
            MedAxis Hospital is committed to supporting patients, families, and
            healthcare professionals through coordinated healthcare services and
            a patient-focused approach.
          </p>

          <Link to="/services" className="about-primary-button">
            Explore Our Services <FiArrowRight />
          </Link>
        </div>

        <div className="about-hero-decoration" aria-hidden="true">
          <FiActivity />
        </div>
      </section>

      {/* Introduction */}
      <section className="about-introduction">
        <div className="about-container about-intro-grid">
          <div className="about-intro-mark">
            <div className="about-intro-icon">
              <FiHeart />
            </div>
            <span>People first. Healthcare always.</span>
          </div>

          <div className="about-intro-content">
            <span className="about-section-label">WHO WE ARE</span>

            <h2>
              Supporting better healthcare through
              <span> care, trust, and technology.</span>
            </h2>

            <p>
              MedAxis Hospital represents a commitment to accessible, organized,
              and responsible healthcare. We recognize that every patient has
              unique needs and that good healthcare depends on compassion,
              professional teamwork, and clear communication.
            </p>

            <p>
              Our hospital management approach brings healthcare services and
              administrative processes together to support patient care,
              coordination among staff, and responsible management of hospital
              information.
            </p>

            <p>
              Through the MedAxis platform, our goal is to support healthcare
              teams with organized patient records, appointments, diagnostics,
              pharmacy operations, billing, and other essential hospital
              workflows.
            </p>
          </div>
        </div>
      </section>

      {/* Mission and vision */}
      <section className="about-purpose">
        <div className="about-container">
          <div className="about-section-heading">
            <span className="about-section-label">OUR PURPOSE</span>
            <h2>What guides MedAxis</h2>
            <p>
              Our purpose shapes how we approach healthcare, patient
              relationships, and hospital management.
            </p>
          </div>

          <div className="about-purpose-grid">
            <article className="about-purpose-card">
              <div className="about-card-icon">
                <FiTarget />
              </div>

              <h3>Our Mission</h3>

              <p>
                To support patient-focused healthcare through compassionate
                service, responsible practices, effective teamwork, and
                organized hospital operations.
              </p>
            </article>

            <article className="about-purpose-card about-purpose-card-accent">
              <div className="about-card-icon">
                <FiEye />
              </div>

              <h3>Our Vision</h3>

              <p>
                To build a trusted healthcare environment where people receive
                respectful care and healthcare professionals are supported by
                efficient processes and appropriate technology.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* Core values */}
      <section className="about-values">
        <div className="about-container">
          <div className="about-section-heading">
            <span className="about-section-label">OUR CORE VALUES</span>
            <h2>Principles behind our care</h2>
            <p>
              The principles that shape the MedAxis approach to healthcare and
              patient service.
            </p>
          </div>

          <div className="about-values-grid">
            {coreValues.map((value) => {
              const Icon = value.icon;

              return (
                <article className="about-value-card" key={value.title}>
                  <div className="about-value-icon">
                    <Icon />
                  </div>

                  <h3>{value.title}</h3>
                  <p>{value.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Healthcare services */}
      <section className="about-care">
        <div className="about-container about-care-grid">
          <div className="about-care-content">
            <span className="about-section-label">OUR HEALTHCARE APPROACH</span>

            <h2>Coordinated services for a better patient experience</h2>

            <p>
              Healthcare involves more than an individual appointment. It
              requires coordination between clinical teams, diagnostic services,
              medication management, and hospital administration.
            </p>

            <p>
              MedAxis is designed to support these connected workflows so
              healthcare teams can manage information and coordinate essential
              hospital activities more effectively.
            </p>

            <Link to="/services" className="about-text-link">
              Learn about our services <FiArrowRight />
            </Link>
          </div>

          <div className="about-care-list">
            <div className="about-care-list-heading">
              <FiActivity />
              <h3>Healthcare and hospital services</h3>
            </div>

            {careServices.map((service) => (
              <div className="about-care-item" key={service}>
                <FiCheckCircle />
                <span>{service}</span>
              </div>
            ))}

            <p className="about-care-note">
              Service availability depends on the facilities and services
              provided by the hospital.
            </p>
          </div>
        </div>
      </section>

      {/* Closing call to action */}
      <section className="about-cta">
        <div className="about-container about-cta-content">
          <div>
            <span className="about-section-label">YOUR HEALTH MATTERS</span>

            <h2>Connect with MedAxis Hospital</h2>

            <p>
              Have a question about our services or need assistance? Our Contact
              page is the place to start.
            </p>
          </div>

          <Link to="/contact" className="about-cta-button">
            Contact Us <FiArrowRight />
          </Link>
        </div>
      </section>
    </div>
  );
}

export default About;
