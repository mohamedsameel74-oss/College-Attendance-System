import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "./api";

export default function Login() {
  const nav = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "teacher" });
  const [error, setError] = useState("");

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const url = isRegister ? "/auth/register" : "/auth/login";
      const { data } = await api.post(url, form);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      nav("/");
    } catch (err) {
      setError(err.response?.data?.message || "Server not reachable");
    }
  };

  return (
    <div className="center">
      <form className="card stack" style={{ width: 340 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{isRegister ? "Create account" : "Login"}</h2>
        {isRegister && (
          <input name="name" placeholder="Full name" value={form.name} onChange={change} required />
        )}
        <input name="email" type="email" placeholder="Email" value={form.email} onChange={change} required />
        <input name="password" type="password" placeholder="Password (min 6)" value={form.password} onChange={change} required />
        {isRegister && (
          <select name="role" value={form.role} onChange={change}>
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
            <option value="student">Student</option>
          </select>
        )}
        {error && <div className="error">{error}</div>}
        <button type="submit">{isRegister ? "Register" : "Login"}</button>
        <button type="button" className="secondary" onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? "Have an account? Login" : "New here? Register"}
        </button>
      </form>
    </div>
  );
}