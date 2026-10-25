import {
  FiActivity,
  FiClipboard,
  FiHeart,
  FiLayers,
  FiPackage,
  FiRadio,
  FiShield,
  FiUsers,
  FiArrowRight,
  FiCheckCircle,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import "./Services.css";

const serviceGroups = [
  {
    icon: FiHeart,
    category: "PATIENT CARE",
    title: "Outpatient and Appointments",
    description:
      "Support for patient registration, appointment scheduling, consultation workflows, and coordination between patients and care teams.",
    features: [
      "Patient registration and records",
      "Appointment coordination",
      "Clinical encounter workflows",
    ],
  },
  {
    icon: FiActivity,
    category: "DIAGNOSTICS",
    title: "Laboratory Services",
    description:
      "Organized workflows for laboratory requests, specimen-related processes, results entry, review, and reporting.",
    features: [
      "Laboratory test catalog",
      "Order and result management",
      "Result review workflows",
    ],
  },
  {
    icon: FiRadio,
    category: "IMAGING",
    title: "Radiology and Imaging",
    description:
      "Support for imaging orders, examination coordination, and radiology report management.",
    features: [
      "Imaging service requests",
      "Examination tracking",
      "Radiology reporting",
    ],
  },
  {
    icon: FiPackage,
    category: "MEDICATIONS",
    title: "Pharmacy and Inventory",
    description:
      "Tools for organizing medication information, stock movements, pharmacy operations, and inventory workflows.",
    features: [
      "Medication records",
      "Stock and batch tracking",
      "Pharmacy workflow management",
    ],
  },
  {
    icon: FiLayers,
    category: "INPATIENT CARE",
    title: "Inpatient and Nursing",
    description:
      "Support for inpatient admission processes, bed coordination, nursing observations, and care documentation.",
    features: [
      "Admission and bed workflows",
      "Nursing observations",
      "Patient care documentation",
    ],
  },
  {
    icon: FiClipboard,
    category: "HOSPITAL OPERATIONS",
    title: "Billing and Administration",
    description:
      "Organized administrative workflows that support financial records, invoices, payments, and hospital reporting.",
    features: ["Invoice management", "Payment records", "Operational reports"],
  },
  {
    icon: FiUsers,
    category: "CARE COORDINATION",
    title: "Critical Care and Theatre",
    description:
      "Dedicated workflow areas designed to support ICU stays, monitoring records, operating theatre scheduling, and procedure coordination.",
    features: [
      "ICU unit and bed workflows",
      "Patient monitoring records",
      "Theatre and procedure coordination",
    ],
  },
  {
    icon: FiShield,
    category: "INFORMATION MANAGEMENT",
    title: "Records and Patient Privacy",
    description:
      "Role-based access and organized information workflows help support responsible handling of hospital and patient information.",
    features: [
      "Role-based access controls",
      "Organized patient records",
      "Responsible information management",
    ],
  },
];

function Services() {
  return (
    <div className="medaxis-services">
      <section className="services-hero">
        <div className="services-container">
          <span className="services-eyebrow">
            <span />
            MEDAXIS HOSPITAL
          </span>

          <h1>
            Healthcare services,
            <span> coordinated with care.</span>
          </h1>

          <p>
            Explore the clinical and administrative service areas represented in
            MedAxis. Our approach connects people, information, and hospital
            workflows to support organized, patient-focused care.
          </p>

          <div className="services-hero-actions">
            <a href="#service-catalog" className="services-primary-button">
              Explore Service Areas <FiArrowRight />
            </a>

            <Link to="/contact" className="services-secondary-button">
              Contact Us
            </Link>
          </div>
        </div>
      </section>

      <section className="services-intro">
        <div className="services-container">
          <div className="services-section-heading">
            <span className="services-section-label">OUR SERVICE AREAS</span>
            <h2>Supporting connected hospital workflows</h2>
            <p>
              From patient registration to clinical coordination and
              administration, MedAxis is designed to bring essential hospital
              processes into one organized platform.
            </p>
          </div>

          <div className="services-grid" id="service-catalog">
            {serviceGroups.map((service, index) => {
              const Icon = service.icon;

              return (
                <article className="services-card" key={service.title}>
                  <div className="services-card-top">
                    <div className="services-card-icon">
                      <Icon />
                    </div>
                    <span className="services-card-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <span className="services-card-category">
                    {service.category}
                  </span>

                  <h3>{service.title}</h3>
                  <p className="services-card-description">
                    {service.description}
                  </p>

                  <ul>
                    {service.features.map((feature) => (
                      <li key={feature}>
                        <FiCheckCircle />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>

          <p className="services-availability-note">
            These are service areas represented by the MedAxis platform. Actual
            clinical services, facilities, and availability should be confirmed
            directly with the hospital.
          </p>
        </div>
      </section>

      <section className="services-approach">
        <div className="services-container services-approach-grid">
          <div>
            <span className="services-section-label">THE MEDAXIS APPROACH</span>
            <h2>Technology that supports people delivering care.</h2>
            <p>
              Hospital technology should help healthcare teams coordinate their
              work, manage information responsibly, and keep essential processes
              organized. It should support professional judgment, not replace
              it.
            </p>
          </div>

          <div className="services-approach-points">
            <div>
              <FiCheckCircle />
              <span>Connected clinical and administrative workflows</span>
            </div>
            <div>
              <FiCheckCircle />
              <span>Organized information and record management</span>
            </div>
            <div>
              <FiCheckCircle />
              <span>Role-based access and accountability</span>
            </div>
            <div>
              <FiCheckCircle />
              <span>Patient-focused service coordination</span>
            </div>
          </div>
        </div>
      </section>

      <section className="services-cta">
        <div className="services-container services-cta-inner">
          <div>
            <span className="services-section-label">
              NEED MORE INFORMATION?
            </span>
            <h2>We are here to help you find the right information.</h2>
            <p>
              Contact MedAxis with questions about hospital services, patient
              support, or general inquiries.
            </p>
          </div>

          <Link to="/contact" className="services-primary-button">
            Contact MedAxis <FiArrowRight />
          </Link>
        </div>
      </section>
    </div>
  );
}

export default Services;
