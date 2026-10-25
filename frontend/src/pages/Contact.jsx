import { useState } from "react";
import {
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiMail,
  FiMapPin,
  FiMessageSquare,
  FiPhone,
  FiSend,
} from "react-icons/fi";

import contactService from "../services/contact.service";
import "./Contact.css";

const initialForm = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

function Contact() {
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (submitting) return;

    setNotice("");

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

    try {
      const response = await contactService.createMessage(payload);

      setNoticeType("success");
      setNotice(
        response?.message ||
          "Thank you. Your message has been sent successfully.",
      );

      setForm(initialForm);
    } catch (error) {
      setNoticeType("error");
      setNotice(
        error.response?.data?.message ||
          "We could not send your message. Please try again later.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="contact-page">
      <section className="contact-hero">
        <div className="contact-container contact-hero-content">
          <span className="contact-eyebrow">
            <FiMessageSquare />
            CONTACT MEDAXIS
          </span>

          <h1>
            We're here to <span>help you.</span>
          </h1>

          <p>
            Have a question about our hospital services or need assistance? Send
            us a message and our team will get back to you.
          </p>

          <div className="contact-hero-note">
            <FiCheckCircle />
            <span>
              Your inquiry will be sent securely to our administrative team.
            </span>
          </div>
        </div>
      </section>

      <section className="contact-main">
        <div className="contact-container contact-layout">
          <aside className="contact-information">
            <span className="contact-section-label">GET IN TOUCH</span>

            <h2>Let's start a conversation.</h2>

            <p className="contact-information-description">
              Contact us for general inquiries, service information, technical
              assistance, or feedback about MedAxis.
            </p>

            <div className="contact-information-list">
              <div className="contact-information-item">
                <div className="contact-information-icon">
                  <FiMail />
                </div>

                <div>
                  <h3>Email</h3>
                  <p>Use the contact form to send your inquiry.</p>
                </div>
              </div>

              <div className="contact-information-item">
                <div className="contact-information-icon">
                  <FiPhone />
                </div>

                <div>
                  <h3>Phone</h3>
                  <p>Contact details can be configured for your hospital.</p>
                </div>
              </div>

              <div className="contact-information-item">
                <div className="contact-information-icon">
                  <FiMapPin />
                </div>

                <div>
                  <h3>Location</h3>
                  <p>
                    Hospital address can be configured in your site details.
                  </p>
                </div>
              </div>

              <div className="contact-information-item">
                <div className="contact-information-icon">
                  <FiClock />
                </div>

                <div>
                  <h3>Response time</h3>
                  <p>Our team will review your message as soon as possible.</p>
                </div>
              </div>
            </div>

            <div className="contact-information-footer">
              <FiArrowRight />
              <p>
                For medical emergencies, contact your local emergency service or
                go to the nearest emergency department. This form is not
                monitored as an emergency service.
              </p>
            </div>
          </aside>

          <section className="contact-form-card">
            <div className="contact-form-heading">
              <span className="contact-section-label">SEND AN INQUIRY</span>
              <h2>How can we help?</h2>
              <p>
                Complete the form below. Your message will be delivered to the
                MedAxis contact inbox.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="contact-form">
              <div className="contact-field">
                <label htmlFor="contact-name">Full name</label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Enter your full name"
                  value={form.name}
                  onChange={handleChange}
                  maxLength={100}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="contact-field">
                <label htmlFor="contact-email">Email address</label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  maxLength={254}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="contact-field">
                <label htmlFor="contact-subject">Subject</label>
                <input
                  id="contact-subject"
                  name="subject"
                  type="text"
                  placeholder="What is your inquiry about?"
                  value={form.subject}
                  onChange={handleChange}
                  maxLength={150}
                  required
                  disabled={submitting}
                />
              </div>

              <div className="contact-field">
                <label htmlFor="contact-message">Message</label>
                <textarea
                  id="contact-message"
                  name="message"
                  placeholder="Write your message here..."
                  value={form.message}
                  onChange={handleChange}
                  rows={6}
                  maxLength={10000}
                  required
                  disabled={submitting}
                />

                <span className="contact-character-count">
                  {form.message.length}/10000 characters
                </span>
              </div>

              {notice && (
                <div
                  className={`contact-notice ${
                    noticeType === "error" ? "is-error" : "is-success"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {noticeType === "error" ? (
                    <FiMessageSquare />
                  ) : (
                    <FiCheckCircle />
                  )}
                  <span>{notice}</span>
                </div>
              )}

              <button
                type="submit"
                className="contact-submit-button"
                disabled={submitting}
              >
                {submitting ? "Sending message..." : "Send message"}
                {!submitting && <FiSend />}
              </button>

              <p className="contact-privacy-note">
                Please do not include passwords or unnecessary sensitive
                personal or medical information in this form.
              </p>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}

export default Contact;
