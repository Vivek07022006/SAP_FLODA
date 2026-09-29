import { useState } from 'react';
import { Layers, Lock, Mail, ArrowRight, AlertCircle, User, BadgeCheck, UserPlus, LogIn, Building2, Zap, ChevronDown } from 'lucide-react';
import { usePersonaStore, PERSONAS } from '../../store/personaStore';
import { Button } from '../../components/ui';
import { toast } from 'sonner';

export default function LoginPage() {
  const { login, register } = usePersonaStore();
  
  // Tabs: 'signin' | 'register'
  const [authMode, setAuthMode] = useState('signin');
  
  // Selected department filter
  const [selectedRole, setSelectedRole] = useState('AUTHORITY');
  
  // Form states with default demo credentials for the initial department
  const [identifier, setIdentifier] = useState('authority@floda.local');
  const [password, setPassword] = useState('FlodaDemo2026!');
  
  // Registration form states
  const [regFullName, setRegFullName] = useState('');
  const [regEmployeeId, setRegEmployeeId] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('AUTHORITY');
  const [regOrg, setRegOrg] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const currentPersona = PERSONAS.find(p => p.role === (authMode === 'register' ? regRole : selectedRole)) || PERSONAS[0];

  const handleDepartmentChange = (role) => {
    setSelectedRole(role);
    setErrorMsg('');
    const targetPersona = PERSONAS.find(p => p.role === role);
    if (targetPersona) {
      setIdentifier(targetPersona.email);
      setPassword('FlodaDemo2026!');
    }
  };

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const isEmail = identifier.includes('@');
      const credentials = isEmail
        ? { email: identifier.trim(), password }
        : { employeeId: identifier.trim(), password };

      const user = await login(credentials);
      toast.success(`Welcome back, ${user.fullName} (${user.badge || user.role})`);
    } catch (err) {
      const msg = err.message || 'Invalid credentials or connection issue';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const user = await login({
        email: currentPersona.email,
        password: 'FlodaDemo2026!',
        role: currentPersona.role
      });
      toast.success(`Authenticated as ${user.fullName} (${user.badge || user.role})`);
    } catch (err) {
      setErrorMsg(err.message || 'Quick login failed');
      toast.error(err.message || 'Quick login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (!regEmployeeId.trim()) {
      setErrorMsg('Employee ID is required');
      setLoading(false);
      return;
    }
    if (!regFullName.trim()) {
      setErrorMsg('Full name is required');
      setLoading(false);
      return;
    }
    if (!regEmail.trim()) {
      setErrorMsg('Official email is required');
      setLoading(false);
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const payload = {
        employeeId: regEmployeeId.trim(),
        fullName: regFullName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        role: regRole,
        organization: regOrg.trim() || undefined
      };

      const newUser = await register(payload);
      toast.success(`Account registered successfully! Welcome to ${newUser.badge} Operations.`);
    } catch (err) {
      const msg = err.message || 'Registration failed';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-portal-wrapper">
      <div className="login-portal-card login-dropdown-system">
        {/* Header */}
        <div className="login-header-zone">
          <div className="login-brand-group">
            <div className="brand-badge">
              <Layers size={20} strokeWidth={2.4} />
            </div>
            <div className="brand-text">
              <div className="flex items-center gap-2">
                <span className="brand-name">FLODA</span>
                <span className="brand-tag">FEDERATED RESILIENCE</span>
              </div>
              <span className="text-xs text-secondary">Logistics Orchestration Control</span>
            </div>
          </div>

          {/* Mode Switcher: Sign In vs New Registration */}
          <div className="auth-mode-tabs">
            <button
              type="button"
              className={`auth-mode-tab ${authMode === 'signin' ? 'active' : ''}`}
              onClick={() => { setAuthMode('signin'); setErrorMsg(''); }}
            >
              <LogIn size={14} />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              className={`auth-mode-tab ${authMode === 'register' ? 'active' : ''}`}
              onClick={() => { setAuthMode('register'); setErrorMsg(''); }}
            >
              <UserPlus size={14} />
              <span>Register</span>
            </button>
          </div>
        </div>

        {/* Dropdown Login Body */}
        <div className="login-dropdown-body">
          {authMode === 'signin' ? (
            /* ================= SIGN IN WITH DROPDOWN ================= */
            <>
              {/* Department Dropdown Selector Section */}
              <div className="department-dropdown-section">
                <div className="login-column-header">
                  <h3 className="card-title text-base">Select Department</h3>
                  <p className="text-xs text-secondary">
                    Choose the organizational domain to authenticate into
                  </p>
                </div>

                <div className="department-select-container">
                  <div className="department-select-wrap">
                    <Building2
                      size={18}
                      className="department-select-icon"
                      style={{ color: currentPersona.color }}
                    />
                    <select
                      id="department-select-dropdown"
                      value={selectedRole}
                      onChange={(e) => handleDepartmentChange(e.target.value)}
                      className="form-select department-dropdown-input"
                    >
                      {PERSONAS.map((p) => (
                        <option key={p.role} value={p.role}>
                          {p.department} ({p.badge})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="department-chevron-icon" />
                  </div>
                </div>

                {/* Active Department Callout Preview */}
                <div className="active-dept-callout mt-3" style={{ borderLeftColor: currentPersona.color }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="persona-avatar-sm" style={{ backgroundColor: currentPersona.color }}>
                        {currentPersona.badge.substring(0, 2)}
                      </span>
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: currentPersona.color }}>
                          {currentPersona.department}
                        </span>
                        <div className="text-sm font-semibold text-primary">
                          {currentPersona.title}
                        </div>
                      </div>
                    </div>
                    <span
                      className="badge-tag-mini font-semibold"
                      style={{
                        color: currentPersona.color,
                        borderColor: `${currentPersona.color}50`,
                        background: `${currentPersona.color}15`
                      }}
                    >
                      {currentPersona.badge}
                    </span>
                  </div>
                  <p className="text-xs text-secondary mt-2 leading-relaxed">
                    {currentPersona.description}
                  </p>
                  <div className="text-[11px] text-muted mt-2 flex items-center gap-1.5">
                    <Building2 size={13} />
                    <span>{currentPersona.org}</span>
                  </div>
                </div>
              </div>

              {/* Credentials & Sign In Form */}
              <form onSubmit={handleLogin} className="login-form-inputs mt-4">
                {errorMsg && (
                  <div className="login-error-alert">
                    <AlertCircle size={15} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="input-group">
                  <label className="input-label" htmlFor="user-identifier">
                    Employee ID or Department Email
                  </label>
                  <div className="input-field-wrap">
                    <User size={15} className="input-field-icon" />
                    <input
                      id="user-identifier"
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="form-input login-field"
                      placeholder="e.g. EMP-AUTH-101 or authority@floda.local"
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label" htmlFor="user-password">
                    Password
                  </label>
                  <div className="input-field-wrap">
                    <Lock size={15} className="input-field-icon" />
                    <input
                      id="user-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="form-input login-field"
                      placeholder="Enter password"
                    />
                  </div>
                </div>

                <div className="login-actions-group flex flex-col gap-2 mt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? (
                      <span>Authenticating...</span>
                    ) : (
                      <>
                        <span>Sign In as {currentPersona.badge} Officer</span>
                        <ArrowRight size={15} />
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={loading}
                    onClick={handleQuickDemoLogin}
                    className="w-full quick-demo-btn"
                  >
                    <Zap size={14} className="text-amber-500 fill-amber-500" />
                    <span>Instant 1-Click Demo Login</span>
                  </Button>
                </div>
              </form>

              <div className="login-register-prompt mt-3">
                <span>New personnel to this organizational domain?</span>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => { setAuthMode('register'); setErrorMsg(''); setRegRole(selectedRole); }}
                >
                  Register Employee Profile
                </button>
              </div>
            </>
          ) : (
            /* ================= NEW USER REGISTRATION FORM ================= */
            <>
              <div className="login-column-header mb-3">
                <h3 className="card-title text-base">Register New Personnel</h3>
                <p className="text-xs text-secondary">
                  Create an operational user profile under your assigned department
                </p>
              </div>

              <form onSubmit={handleRegister} className="login-form-inputs">
                {errorMsg && (
                  <div className="login-error-alert">
                    <AlertCircle size={15} />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="input-group">
                  <div className="flex items-center justify-between mb-1">
                    <label className="input-label mb-0" htmlFor="reg-role">
                      Select Department *
                    </label>
                    <span className="text-xs text-secondary">Choose domain</span>
                  </div>
                  <div className="department-select-wrap">
                    <Building2
                      size={18}
                      className="department-select-icon"
                      style={{ color: currentPersona.color }}
                    />
                    <select
                      id="reg-role"
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value)}
                      className="form-select department-dropdown-input"
                    >
                      {PERSONAS.map(p => (
                        <option key={p.role} value={p.role}>
                          {p.department} ({p.badge})
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="department-chevron-icon" />
                  </div>
                  <p className="text-xs text-secondary mt-1">
                    Choose the organizational domain to authenticate into
                  </p>
                </div>

                <div className="form-row-two mt-1">
                  <div className="input-group">
                    <label className="input-label" htmlFor="reg-emp-id">
                      Employee ID *
                    </label>
                    <div className="input-field-wrap">
                      <BadgeCheck size={15} className="input-field-icon" />
                      <input
                        id="reg-emp-id"
                        type="text"
                        required
                        value={regEmployeeId}
                        onChange={(e) => setRegEmployeeId(e.target.value)}
                        className="form-input login-field"
                        placeholder="e.g. EMP-AUTH-808"
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label" htmlFor="reg-name">
                      Full Legal / Officer Name *
                    </label>
                    <div className="input-field-wrap">
                      <User size={15} className="input-field-icon" />
                      <input
                        id="reg-name"
                        type="text"
                        required
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        className="form-input login-field"
                        placeholder="e.g. Full Legal Name"
                      />
                    </div>
                  </div>
                </div>

                <div className="input-group mt-1">
                  <label className="input-label" htmlFor="reg-email">
                    Official Department Email *
                  </label>
                  <div className="input-field-wrap">
                    <Mail size={15} className="input-field-icon" />
                    <input
                      id="reg-email"
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      className="form-input login-field"
                      placeholder="e.g. officer@floda.local"
                    />
                  </div>
                </div>

                <div className="form-row-two mt-1">
                  <div className="input-group">
                    <label className="input-label" htmlFor="reg-password">
                      Security Password *
                    </label>
                    <div className="input-field-wrap">
                      <Lock size={15} className="input-field-icon" />
                      <input
                        id="reg-password"
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="form-input login-field"
                        placeholder="Min 6 characters"
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label" htmlFor="reg-org">
                      Agency / Organization
                    </label>
                    <div className="input-field-wrap">
                      <Building2 size={15} className="input-field-icon" />
                      <input
                        id="reg-org"
                        type="text"
                        value={regOrg}
                        onChange={(e) => setRegOrg(e.target.value)}
                        className="form-input login-field"
                        placeholder={currentPersona.org}
                      />
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading}
                  className="w-full mt-3"
                >
                  {loading ? (
                    <span>Registering Profile...</span>
                  ) : (
                    <>
                      <UserPlus size={15} />
                      <span>Complete Registration & Sign In</span>
                    </>
                  )}
                </Button>
              </form>

              <div className="login-register-prompt mt-3">
                <span>Already have an employee account?</span>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => { setAuthMode('signin'); setErrorMsg(''); }}
                >
                  Back to Sign In
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
