import { Fragment, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "./api";

export default function StudentView() {
  const nav = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [data, setData] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api.get("/my-attendance")
      .then((r) => setData(r.data))
      .catch(() => { localStorage.clear(); nav("/login"); });
  }, []);

  const toggle = async (id) => {
    if (openId === id) return setOpenId(null);
    const r = await api.get("/my-history", { params: { courseId: id } });
    setHistory(r.data);
    setOpenId(id);
  };

  const logout = () => {
    localStorage.clear();
    nav("/login");
  };

  return (
    <div className="container">
      <header>
        <h2>My Attendance</h2>
        <div>
          {user.name} (student){" "}
          <button className="secondary" onClick={logout}>Logout</button>
        </div>
      </header>

      <div className="card">
        {!data && <p>Loading...</p>}
        {data && !data.student && (
          <p>
            Your account isn't linked to a student record yet. Ask your teacher to add you
            as a student using the same email you registered with ({user.email}).
          </p>
        )}
        {data && data.student && (
          <>
            <p><b>{data.student.name}</b> (Roll no: {data.student.rollNo})</p>
            <table>
              <thead><tr><th>Course</th><th>Present</th><th>Total</th><th>%</th><th></th></tr></thead>
              <tbody>
                {data.courses.map((c) => (
                  <Fragment key={c.code}>
                    <tr>
                      <td>{c.code} - {c.name}</td>
                      <td>{c.present}</td>
                      <td>{c.total}</td>
                      <td className={c.total && c.percentage < 75 ? "low" : ""}>{c.percentage}%</td>
                      <td>
                        <button className="secondary" onClick={() => toggle(c.id)}>
                          {openId === c.id ? "Hide" : "View dates"}
                        </button>
                      </td>
                    </tr>
                    {openId === c.id && (
                      <tr>
                        <td colSpan={5}>
                          {history.length === 0 && <i>No classes recorded yet.</i>}
                          {history.map((h) => (
                            <div key={h._id}>
                              {h.date}:{" "}
                              <span className={h.status === "absent" ? "low" : "ok"}>
                                {h.status === "present" ? "Present" : "Absent"}
                              </span>
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {data.courses.length === 0 && <p>No courses yet.</p>}
          </>
        )}
      </div>
    </div>
  );
}