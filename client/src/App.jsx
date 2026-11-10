import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./Login";
import Dashboard from "./Dashboard";

const Private = ({ children }) =>
  localStorage.getItem("token") ? children : <Navigate to="/login" />;

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Private><Dashboard /></Private>} />
      </Routes>
    </BrowserRouter>
  );
}