require("dotenv").config();
const express = require("express");
const path = require("path");
const axios = require("axios");

const app = express();

// ---- Config ----
const PORT = process.env.PORT || 3000;
const PRIVATE_APP_ACCESS_TOKEN = process.env.PRIVATE_APP_ACCESS_TOKEN;
const CUSTOM_OBJECT_TYPE = process.env.CUSTOM_OBJECT_TYPE; // must be 2-56743582

if (!PRIVATE_APP_ACCESS_TOKEN) {
  console.error("Missing PRIVATE_APP_ACCESS_TOKEN in .env");
  process.exit(1);
}
if (!CUSTOM_OBJECT_TYPE) {
  console.error("Missing CUSTOM_OBJECT_TYPE in .env");
  process.exit(1);
}

// ---- Middleware ----
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use("/css", express.static(path.join(__dirname, "public", "css")));

// ---- View engine ----
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

// ---- Axios client ----
const hubspot = axios.create({
  baseURL: "https://api.hubapi.com",
  headers: {
    Authorization: `Bearer ${PRIVATE_APP_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// GET / (homepage) - list Pets custom object records (newest first)
app.get("/", async (req, res) => {
  try {
    const properties = ["name", "bio", "species", "hs_createdate"];

    // Use Search API so we can reliably sort newest first
    const response = await hubspot.post(
      `/crm/v3/objects/${CUSTOM_OBJECT_TYPE}/search`,
      {
        filterGroups: [],
        sorts: ["-hs_createdate"],
        properties,
        limit: 100,
      }
    );

    const records = (response.data.results || []).map((r) => ({
      id: r.id,
      createdate: r.properties?.hs_createdate || "",
      name: r.properties?.name || "",
      bio: r.properties?.bio || "",
      species: r.properties?.species || "",
    }));

    return res.render("homepage", {
      title: "Homepage | Integrating With HubSpot I Practicum",
      records,
    });
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;

    return res.status(500).render("homepage", {
      title: "Homepage | Integrating With HubSpot I Practicum",
      records: [],
      errorMessage:
        status && data
          ? `HubSpot API Error ${status}: ${JSON.stringify(data)}`
          : `Request failed: ${err.message}`,
    });
  }
});

// GET /update-cobj - show form
app.get("/update-cobj", (req, res) => {
  return res.render("updates", {
    title: "Update Custom Object Form | Integrating With HubSpot I Practicum",
  });
});

// POST /update-cobj - create record then redirect home
app.post("/update-cobj", async (req, res) => {
  try {
    const { name, bio, species } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).render("updates", {
        title: "Update Custom Object Form | Integrating With HubSpot I Practicum",
        errorMessage: "Name is required.",
        formValues: { name, bio, species },
      });
    }

    await hubspot.post(`/crm/v3/objects/${CUSTOM_OBJECT_TYPE}`, {
      properties: {
        name: name.trim(),
        bio: bio ? bio.trim() : "",
        species: species ? species.trim() : "",
      },
    });

    return res.redirect("/");
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;

    return res.status(500).render("updates", {
      title: "Update Custom Object Form | Integrating With HubSpot I Practicum",
      errorMessage:
        status && data
          ? `HubSpot API Error ${status}: ${JSON.stringify(data)}`
          : `Request failed: ${err.message}`,
      formValues: req.body,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});

