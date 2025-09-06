import express from "express";
import { getLinks } from "../controllers/getLinks.js";

export const router = express.Router();

router.post("/", getLinks);
