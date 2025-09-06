import express from "express";
import getData from "./Controllers/brilliance.js";
const app = express();
const PORT = 8000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});
app.post("/brilliance", getData);
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
