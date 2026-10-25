import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { FiActivity, FiEye, FiEyeOff, FiLock, FiMail } from "react-icons/fi";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext";
import "./Login.css";

export default function Login() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  function handleChange(event) {
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.email.trim() || !form.password) {
      toast.error("Enter your email and password.");
      return;
    }

    try {
      setSubmitting(true);
      await login(form);
      toast.success("Welcome to MedAxis.");
      navigate(location.state?.from || "/dashboard", { replace: true });
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Unable to sign in. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand">
          <span className="brand-mark">
            <FiActivity />
          </span>
          <span>MedAxis</span>
        </div>

        <div className="login-brand-content">
          <span className="eyebrow">HOSPITAL MANAGEMENT SYSTEM</span>
          <h1>
            Better coordination.
            <br />
            Better care.
          </h1>
          <p>
            A connected workspace for hospital teams to manage patients,
            appointments and clinical operations.
          </p>
        </div>

        <div className="login-brand-footer">MedAxis Hospital ERP</div>
      </section>

      <section className="login-form-panel">
        <div className="login-form-wrap">
          <div className="login-mobile-brand">
            <span className="brand-mark">
              <FiActivity />
            </span>
            <span>MedAxis</span>
          </div>

          <span className="eyebrow">SECURE ACCESS</span>
          <h2>Welcome back</h2>
          <p className="login-subtitle">
            Sign in with your authorized hospital account.
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="email">Email address</label>
            <div className="login-input-wrap">
              <FiMail />
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="username"
                placeholder="you@hospital.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <label htmlFor="password">Password</label>
            <div className="login-input-wrap">
              <FiLock />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                required
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>

            <button
              type="submit"
              className="login-submit"
              disabled={submitting}
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="login-help">
            Need access? Contact your hospital administrator.
          </p>

          <Link to="/" className="login-back-link">
            Return to MedAxis home
          </Link>
        </div>
      </section>
    </main>
  );
}
