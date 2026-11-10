import StudentView from "./StudentView";
import History from "./History";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "./api";

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  return user.role === "student" ? <StudentView /> : <StaffDashboard />;
}

function StaffDashboard() {
  const nav = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [tab, setTab] = useState("attendance");
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);

  const load = async () => {
    try {
      const [s, c] = await Promise.all([api.get("/students"), api.get("/courses")]);
      setStudents(s.data);
      setCourses(c.data);
    } catch {
      logout();
    }
  };
  useEffect(() => { load(); }, []);

  const logout = () => {
    localStorage.clear();
    nav("/login");
  };

  const canEdit = user.role === "admin" || user.role === "teacher";

  return (
    <div className="container">
      <header>
        <h2>College Attendance System</h2>
        <div>
          {user.name} ({user.role}){" "}
          <button className="secondary" onClick={logout}>Logout</button>
        </div>
      </header>

      <div className="row">
        {["attendance", "report", "history", "students", "courses"].map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "attendance" && <Attendance students={students} courses={courses} canEdit={canEdit} />}
      {tab === "report" && <Report courses={courses} />}
      {tab === "history" && <History students={students} courses={courses} />}
      {tab === "students" && <Students students={students} reload={load} canEdit={canEdit} />}
      {tab === "courses" && <Courses courses={courses} reload={load} canEdit={canEdit} />}
    </div>
  );
}

/* ---------------- Students ---------------- */
function Students({ students, reload, canEdit }) {
  const empty = { rollNo: "", name: "", department: "BSc.IT", email: "" };
  const [form, setForm] = useState(empty);
  const [error, setError] = useState("");

  const add = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/students", form);
      setForm(empty);
      reload();
    } catch (err) {
      setError(err.response?.data?.message || "Failed");
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this student and their attendance?")) return;
    await api.delete(`/students/${id}`);
    reload();
  };

  return (
    <div className="card">
      {canEdit && (
        <form className="row" onSubmit={add} autoComplete="off">
          <input placeholder="Roll no" value={form.rollNo} onChange={(e) => setForm({ ...form, rollNo: e.target.value })} required />
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          <input type="email" placeholder="Student email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <button type="submit">Add student</button>
        </form>
      )}
      {error && <div className="error">{error}</div>}
      <table>
        <thead><tr><th>Roll no</th><th>Name</th><th>Department</th><th>Email</th><th></th></tr></thead>
        <tbody>
          {students.map((s) => (
            <tr key={s._id}>
              <td>{s.rollNo}</td><td>{s.name}</td><td>{s.department}</td><td>{s.email || "-"}</td>
              <td>{canEdit && <button className="danger" onClick={() => remove(s._id)}>Delete</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {students.length === 0 && <p>No students yet.</p>}
    </div>
  );
}

/* ---------------- Courses ---------------- */
function Courses({ courses, reload, canEdit }) {
  const [form, setForm] = useState({ code: "", name: "" });
  const [error, setError] = useState("");

  const add = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/courses", form);
      setForm({ code: "", name: "" });
      reload();
    } catch (err) {
      setError(err.response?.data?.message || "Failed");
    }
  };

  return (
    <div className="card">
      {canEdit && (
        <form className="row" onSubmit={add}>
          <input placeholder="Code (e.g. ASP101)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input placeholder="Course name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <button type="submit">Add course</button>
        </form>
      )}
      {error && <div className="error">{error}</div>}
      <table>
        <thead><tr><th>Code</th><th>Name</th></tr></thead>
        <tbody>
          {courses.map((c) => (<tr key={c._id}><td>{c.code}</td><td>{c.name}</td></tr>))}
        </tbody>
      </table>
      {courses.length === 0 && <p>No courses yet.</p>}
    </div>
  );
}

/* ---------------- Mark Attendance ---------------- */
function Attendance({ students, courses, canEdit }) {
  const [courseId, setCourseId] = useState("");
  const [date, setDate] = useState(today());
  const [marks, setMarks] = useState({});
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!courseId) return;
    api.get("/attendance", { params: { courseId, date } }).then((r) => {
      const m = {};
      students.forEach((s) => (m[s._id] = true)); // default: present
      r.data.forEach((a) => (m[a.student] = a.status === "present"));
      setMarks(m);
      setMsg("");
    });
  }, [courseId, date, students]);

  const save = async () => {
    try {
      await api.post("/attendance", {
        courseId,
        date,
        records: students.map((s) => ({
          studentId: s._id,
          status: marks[s._id] === false ? "absent" : "present",
        })),
      });
      setMsg("Attendance saved");
    } catch (err) {
      setMsg(err.response?.data?.message || "Failed to save");
    }
  };

  return (
    <div className="card">
      <div className="row">
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">Select course</option>
          {courses.map((c) => (<option key={c._id} value={c._id}>{c.code} - {c.name}</option>))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {courseId && (
        <>
          <table>
            <thead><tr><th>Roll no</th><th>Name</th><th>Present</th></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s._id}>
                  <td>{s.rollNo}</td>
                  <td>{s.name}</td>
                  <td>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={marks[s._id] !== false}
                      onChange={(e) => setMarks({ ...marks, [s._id]: e.target.checked })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {students.length === 0 && <p>Add students first.</p>}
          {canEdit && students.length > 0 && (
            <div className="row" style={{ marginTop: 12 }}>
              <button onClick={save}>Save attendance</button>
              {msg && <span className="ok">{msg}</span>}
            </div>
          )}
        </>
      )}
      {!courseId && <p>Select a course and date to mark attendance.</p>}
    </div>
  );
}

/* ---------------- Report ---------------- */
function Report({ courses }) {
  const [courseId, setCourseId] = useState("");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!courseId) return setRows([]);
    api.get(`/reports/course/${courseId}`).then((r) => setRows(r.data));
  }, [courseId]);

  const exportCsv = () => {
    const header = ["Roll no", "Name", "Present", "Total", "Percentage"];
    const lines = rows.map((r) => [
      r.rollNo,
      `"${r.name.replace(/"/g, '""')}"`,
      r.present,
      r.total,
      r.percentage,
    ]);
    const csv = [header, ...lines].map((l) => l.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const course = courses.find((c) => c._id === courseId);
    a.download = `attendance-${course?.code || "report"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="card">
      <div className="row">
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">Select course</option>
          {courses.map((c) => (<option key={c._id} value={c._id}>{c.code} - {c.name}</option>))}
        </select>
        {rows.length > 0 && <button onClick={exportCsv}>Export CSV</button>}
      </div>
      {courseId && (
        <table>
          <thead><tr><th>Roll no</th><th>Name</th><th>Present</th><th>Total</th><th>%</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.studentId}>
                <td>{r.rollNo}</td><td>{r.name}</td><td>{r.present}</td><td>{r.total}</td>
                <td className={r.total && r.percentage < 75 ? "low" : ""}>{r.percentage}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!courseId && <p>Select a course to see attendance percentages. Below 75% shows in red.</p>}
    </div>
  );
}