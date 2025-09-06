import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import { router } from "./routes/route.js";
import cors from "cors";

const app = express();

const PORT = 8000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use("/public", express.static("public"));
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});
app.use("/api", router);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
