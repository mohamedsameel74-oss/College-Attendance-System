import { useEffect, useState } from "react";
import api from "./api";

export default function History({ students, courses }) {
  const [courseId, setCourseId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!courseId || !studentId) return setRows([]);
    api.get("/history", { params: { courseId, studentId } }).then((r) => setRows(r.data));
  }, [courseId, studentId]);

  const present = rows.filter((r) => r.status === "present").length;
  const pct = rows.length ? Math.round((present / rows.length) * 100) : 0;

  return (
    <div className="card">
      <div className="row">
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">Select course</option>
          {courses.map((c) => (<option key={c._id} value={c._id}>{c.code} - {c.name}</option>))}
        </select>
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">Select student</option>
          {students.map((s) => (<option key={s._id} value={s._id}>{s.rollNo} - {s.name}</option>))}
        </select>
      </div>

      {courseId && studentId && (
        <>
          <p>
            Present <b>{present}</b> of <b>{rows.length}</b> classes (
            <span className={rows.length && pct < 75 ? "low" : ""}>{pct}%</span>)
          </p>
          <table>
            <thead><tr><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td>{r.date}</td>
                  <td className={r.status === "absent" ? "low" : "ok"}>
                    {r.status === "present" ? "Present" : "Absent"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p>No attendance recorded for this student in this course yet.</p>}
        </>
      )}
      {(!courseId || !studentId) && <p>Select a course and a student to see their day-by-day attendance.</p>}
    </div>
  );
}