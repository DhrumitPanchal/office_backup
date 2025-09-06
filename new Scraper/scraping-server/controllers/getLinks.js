import { Testing2 } from "./louily.js";
import { Testing } from "./Maxine.js";

export async function getLinks(req, res) {
  try {
    const { website, url } = await req.body;

    if (!website || !url) {
      return res.status(400).json({ error: "Website and URL are required" });
    }

    console.log("Request Body:", req.body);
    let data;

    if (website === "Maxine") {
      data = await Testing(req, res, url);
    } else if (website === "Louily") {
      // Call another function for a different website
      data = await Testing2(req, res, url);
    } else {
      return res.status(400).json({ error: "Unsupported website" });
    }
  } catch (error) {
    console.error("Error fetching links:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
