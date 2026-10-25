import { useState } from "react";
import {
  FiClock,
  FiMail,
  FiMapPin,
  FiMessageCircle,
  FiPhone,
  FiSend,
  FiShield,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import contactService from "../services/contact.service";
import "./Contact.css";

function Contact() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setNotice("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting) return;

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      subject: form.subject.trim(),
      message: form.message.trim(),
    };

    if (
      !payload.name ||
      !payload.email ||
      !payload.subject ||
      !payload.message
    ) {
      setNoticeType("error");
      setNotice("Please complete all fields before submitting.");
      return;
    }

    setSubmitting(true);
    setNotice("");

    try {
      const response = await contactService.createMessage(payload);

      setNoticeType("success");
      setNotice(
        response?.message ||
          "Your inquiry has been submitted successfully. Thank you for contacting MedAxis.",
      );

      setForm({
        name: "",
        email: "",
        subject: "",
        message: "",
      });
    } catch (error) {
      setNoticeType("error");
      setNotice(
        error.response?.data?.message ||
          "We could not submit your inquiry. Please try again later.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="medaxis-contact">
      <section className="contact-hero">
        <div className="contact-container">
          <span className="contact-eyebrow">
            <span />
            WE ARE HERE TO HELP
          </span>

          <h1>
            Contact <span>MedAxis Hospital</span>
          </h1>

          <p>
            Have a question about our services or need assistance? Find the
            right way to contact our team.
          </p>

          <div className="contact-breadcrumb">
            <Link to="/">Home</Link>
            <span>/</span>
            <span>Contact</span>
          </div>
        </div>
      </section>

      <section className="contact-main">
        <div className="contact-container">
          <div className="contact-section-heading">
            <span className="contact-section-label">GET IN TOUCH</span>

            <h2>How can we assist you?</h2>

            <p>
              Use the contact information published by your hospital or prepare
              an inquiry using the form below.
            </p>
          </div>

          <div className="contact-grid">
            <div className="contact-information">
              <div className="contact-info-heading">
                <h3>Contact Information</h3>
                <p>
                  Replace these details with your hospital's verified address,
                  telephone number, and email address.
                </p>
              </div>

              <div className="contact-info-card">
                <div className="contact-info-icon">
                  <FiMapPin />
                </div>
                <div>
                  <h4>Hospital Address</h4>
                  <p>Add the official hospital address here.</p>
                </div>
              </div>

              <div className="contact-info-card">
                <div className="contact-info-icon">
                  <FiPhone />
                </div>
                <div>
                  <h4>Telephone</h4>
                  <p>Add the official hospital phone number here.</p>
                </div>
              </div>

              <div className="contact-info-card">
                <div className="contact-info-icon">
                  <FiMail />
                </div>
                <div>
                  <h4>Email</h4>
                  <p>Add the official hospital email address here.</p>
                </div>
              </div>

              <div className="contact-info-card">
                <div className="contact-info-icon">
                  <FiClock />
                </div>
                <div>
                  <h4>Working Hours</h4>
                  <p>Add the hospital's confirmed office and service hours.</p>
                </div>
              </div>

              <div className="contact-info-note">
                <FiShield />
                <p>
                  Please do not submit passwords, identity numbers, medical
                  records, or other sensitive patient information through this
                  contact form.
                </p>
              </div>
            </div>

            <div className="contact-form-panel">
              <div className="contact-form-heading">
                <div className="contact-form-heading-icon">
                  <FiMessageCircle />
                </div>

                <div>
                  <h3>Send an Inquiry</h3>
                  <p>Complete the fields below.</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="contact-form">
                <div className="contact-form-field">
                  <label htmlFor="contact-name">Full Name</label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Enter your name"
                    autoComplete="name"
                    maxLength={100}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="contact-form-field">
                  <label htmlFor="contact-email">Email Address</label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    autoComplete="email"
                    maxLength={254}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="contact-form-field">
                  <label htmlFor="contact-subject">Subject</label>
                  <input
                    id="contact-subject"
                    name="subject"
                    type="text"
                    value={form.subject}
                    onChange={handleChange}
                    placeholder="How can we help?"
                    maxLength={150}
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="contact-form-field">
                  <label htmlFor="contact-message">Your Message</label>
                  <textarea
                    id="contact-message"
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    placeholder="Write your general inquiry here..."
                    rows={5}
                    maxLength={10000}
                    required
                    disabled={submitting}
                  />

                  <span className="contact-character-count">
                    {form.message.length}/10000 characters
                  </span>
                </div>

                {notice && (
                  <p
                    className={`contact-form-notice ${
                      noticeType === "error" ? "is-error" : "is-success"
                    }`}
                    role="status"
                    aria-live="polite"
                  >
                    {notice}
                  </p>
                )}

                <button
                  type="submit"
                  className="contact-submit-button"
                  disabled={submitting}
                >
                  {submitting ? "Sending Inquiry..." : "Send Inquiry"}
                  {!submitting && <FiSend />}
                </button>

                <p className="contact-form-disclaimer">
                  Your inquiry will be submitted to the MedAxis backend and
                  stored for authorized administrators to review. Please do not
                  include unnecessary sensitive personal or medical information.
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>

      <section className="contact-support">
        <div className="contact-container contact-support-inner">
          <div>
            <span className="contact-section-label">DISCOVER MEDAXIS</span>
            <h2>Learn more about our hospital approach.</h2>
            <p>
              Explore our healthcare service areas and the principles that guide
              the MedAxis platform.
            </p>
          </div>

          <div className="contact-support-actions">
            <Link to="/about" className="contact-outline-button">
              About MedAxis
            </Link>

            <Link to="/services" className="contact-primary-button">
              Explore Services
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Contact;
