import { createRoot } from "react-dom/client";
import Dashboard from "../app/page";
import "../app/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("Dashboard root is missing.");
createRoot(root).render(<Dashboard />);
