import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// ---------- DATABASE CONNECTION ----------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });

// ---------- MODELS ----------
const User = mongoose.model(
  "User",
  new mongoose.Schema(
    {
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, unique: true, lowercase: true },
      password: { type: String, required: true, minlength: 6 },
      role: { type: String, enum: ["admin", "teacher", "student"], default: "student" },
    },
    { timestamps: true }
  )
);

const Student = mongoose.model(
  "Student",
  new mongoose.Schema(
    {
      rollNo: { type: String, required: true, unique: true, trim: true },
      name: { type: String, required: true, trim: true },
      department: { type: String, trim: true, default: "BSc.IT" },
      email: { type: String, trim: true, lowercase: true },
    },
    { timestamps: true }
  )
);

const Course = mongoose.model(
  "Course",
  new mongoose.Schema(
    {
      code: { type: String, required: true, unique: true, trim: true },
      name: { type: String, required: true, trim: true },
      teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
  )
);

const attendanceSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    date: { type: String, required: true }, // format: YYYY-MM-DD
    status: { type: String, enum: ["present", "absent"], required: true },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
attendanceSchema.index({ course: 1, student: 1, date: 1 }, { unique: true });
const Attendance = mongoose.model("Attendance", attendanceSchema);

// ---------- HELPERS ----------
const makeToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

const protect = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer "))
    return res.status(401).json({ message: "Not authorized" });
  try {
    req.user = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

const allowRoles = (...roles) => (req, res, next) =>
  roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ message: "You don't have permission" });

// ---------- AUTH ROUTES ----------
app.get("/", (req, res) => res.send("Attendance API running"));

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required" });

    if (await User.findOne({ email }))
      return res.status(409).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, role });

    res.status(201).json({
      token: makeToken(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ message: "Invalid email or password" });

    res.json({
      token: makeToken(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---------- STUDENT ROUTES ----------
app.get("/api/students", protect, allowRoles("admin", "teacher"), async (req, res) => {
  res.json(await Student.find().sort("rollNo"));
});

app.post("/api/students", protect, allowRoles("admin", "teacher"), async (req, res) => {
  try {
    const { rollNo, name, department, email } = req.body;
    if (!rollNo || !name) return res.status(400).json({ message: "Roll no and name required" });
    res.status(201).json(await Student.create({ rollNo, name, department, email }));
  } catch (err) {
    res.status(400).json({ message: err.code === 11000 ? "Roll no already exists" : err.message });
  }
});

app.delete("/api/students/:id", protect, allowRoles("admin", "teacher"), async (req, res) => {
  await Student.findByIdAndDelete(req.params.id);
  await Attendance.deleteMany({ student: req.params.id });
  res.json({ message: "Deleted" });
});

// ---------- COURSE ROUTES ----------
app.get("/api/courses", protect, async (req, res) => {
  res.json(await Course.find().sort("code"));
});

app.post("/api/courses", protect, allowRoles("admin", "teacher"), async (req, res) => {
  try {
    const { code, name } = req.body;
    if (!code || !name) return res.status(400).json({ message: "Code and name required" });
    res.status(201).json(await Course.create({ code, name, teacher: req.user.id }));
  } catch (err) {
    res.status(400).json({ message: err.code === 11000 ? "Course code already exists" : err.message });
  }
});

// ---------- ATTENDANCE ROUTES ----------
app.get("/api/attendance", protect, allowRoles("admin", "teacher"), async (req, res) => {
  const { courseId, date } = req.query;
  res.json(await Attendance.find({ course: courseId, date }));
});

app.post("/api/attendance", protect, allowRoles("admin", "teacher"), async (req, res) => {
  try {
    const { courseId, date, records } = req.body;
    if (!courseId || !date || !Array.isArray(records))
      return res.status(400).json({ message: "courseId, date and records required" });

    const ops = records.map((r) => ({
      updateOne: {
        filter: { course: courseId, student: r.studentId, date },
        update: { $set: { status: r.status, markedBy: req.user.id } },
        upsert: true,
      },
    }));
    await Attendance.bulkWrite(ops);
    res.json({ message: "Attendance saved" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---------- REPORT ROUTE ----------
app.get("/api/reports/course/:courseId", protect, allowRoles("admin", "teacher"), async (req, res) => {
  const students = await Student.find().sort("rollNo");
  const records = await Attendance.find({ course: req.params.courseId });
  const report = students.map((s) => {
    const mine = records.filter((r) => String(r.student) === String(s._id));
    const present = mine.filter((r) => r.status === "present").length;
    return {
      studentId: s._id,
      rollNo: s.rollNo,
      name: s.name,
      present,
      total: mine.length,
      percentage: mine.length ? Math.round((present / mine.length) * 100) : 0,
    };
  });
  res.json(report);
});

// ---------- MY ATTENDANCE (student view, used later) ----------
app.get("/api/my-attendance", protect, async (req, res) => {
  const me = await User.findById(req.user.id);
  const student = me && (await Student.findOne({ email: me.email }));
  if (!student) return res.json({ student: null, courses: [] });

  const courses = await Course.find().sort("code");
  const records = await Attendance.find({ student: student._id });

  const summary = courses.map((c) => {
    const mine = records.filter((r) => String(r.course) === String(c._id));
    const present = mine.filter((r) => r.status === "present").length;
    return {
            id: c._id,
      code: c.code,
      name: c.name,
      present,
      total: mine.length,
      percentage: mine.length ? Math.round((present / mine.length) * 100) : 0,
    };
  });

  res.json({ student: { rollNo: student.rollNo, name: student.name }, courses: summary });
});
app.get("/api/my-attendance", protect, async (req, res) => {
  const me = await User.findById(req.user.id);
  const student = me && (await Student.findOne({ email: me.email }));
  if (!student) return res.json({ student: null, courses: [] });

  const courses = await Course.find().sort("code");
  const records = await Attendance.find({ student: student._id });

  const summary = courses.map((c) => {
    const mine = records.filter((r) => String(r.course) === String(c._id));
    const present = mine.filter((r) => r.status === "present").length;
    return {
      id: c._id,
      code: c.code,
      name: c.name,
      present,
      total: mine.length,
      percentage: mine.length ? Math.round((present / mine.length) * 100) : 0,
    };
  });

  res.json({ student: { rollNo: student.rollNo, name: student.name }, courses: summary });
});
// ---------- HISTORY ----------
app.get("/api/history", protect, allowRoles("admin", "teacher"), async (req, res) => {
  const { courseId, studentId } = req.query;
  res.json(await Attendance.find({ course: courseId, student: studentId }).sort("-date"));
});

app.get("/api/my-history", protect, async (req, res) => {
  const me = await User.findById(req.user.id);
  const student = me && (await Student.findOne({ email: me.email }));
  if (!student) return res.json([]);
  res.json(
    await Attendance.find({ course: req.query.courseId, student: student._id }).sort("-date")
  );
});
// ---------- START SERVER ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:5000`));