const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const SONGS_PATH = path.join(__dirname, "songs.json");
const QUEUE_PATH = path.join(__dirname, "queue.json");

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error("Failed reading JSON:", filePath, err.message);
    return fallback;
  }
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

const songsData = readJsonFile(SONGS_PATH, []);

const knownSongs = songsData.map(function (entry) {
  const song = String(entry.song || "").trim();
  const artist = String(entry.artist || "").trim();
  return {
    song: song,
    artist: artist,
    full: song + " - " + artist
  };
});

let requestQueue = readJsonFile(QUEUE_PATH, []);
let nextId = requestQueue.reduce(function (max, item) {
  return Math.max(max, Number(item.id) || 0);
}, 0) + 1;

app.use(cors());
app.use(express.json());

app.use(function (req, res, next) {
  res.setHeader(
    "Content-Security-Policy",
    "frame-ancestors 'self' https://*.framer.website https://framer.com https://*.framer.com"
  );
  next();
});

app.use(express.static("public"));

app.get("/api/songs", function (req, res) {
  const q = String(req.query.q || "").trim().toLowerCase();

  if (!q) {
    return res.json(knownSongs.slice(0, 25));
  }

  const results = knownSongs.filter(function (entry) {
    return (
      entry.song.toLowerCase().includes(q) ||
      entry.artist.toLowerCase().includes(q) ||
      entry.full.toLowerCase().includes(q)
    );
  }).slice(0, 25);

  res.json(results);
});

app.get("/api/queue", function (req, res) {
  res.json(requestQueue);
});

app.post("/api/queue", function (req, res) {
  const song = String(req.body.song || "").trim();
  const artist = String(req.body.artist || "").trim();
  const requester = String(req.body.requester || "").trim();
  const email = String(req.body.email || "").trim();
  const phone = String(req.body.phone || "").trim();

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  if (!email.includes("@")) {
    return res.status(400).json({ error: "Invalid email" });
  }

  if (!song) {
    return res.status(400).json({ error: "Song required" });
  }

  const newRequest = {
    id: nextId++,
    song: song,
    artist: artist,
    requester: requester,
    email: email,
    phone: phone,
    time: new Date().toISOString(),
    status: "queued"
  };

  requestQueue.push(newRequest);
  writeJsonFile(QUEUE_PATH, requestQueue);

  console.log("NEW REQUEST:", newRequest);

  res.json({ success: true, request: newRequest });
});

app.patch("/api/queue/:id", function (req, res) {
  const id = Number(req.params.id);
  const status = String(req.body.status || "").trim();

  const allowedStatuses = ["queued", "played"];

  if (allowedStatuses.indexOf(status) === -1) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const item = requestQueue.find(function (r) {
    return r.id === id;
  });

  if (!item) {
    return res.status(404).json({ error: "Request not found" });
  }

  item.status = status;
  writeJsonFile(QUEUE_PATH, requestQueue);

  res.json({ success: true, request: item });
});

app.delete("/api/queue/:id", function (req, res) {
  const id = Number(req.params.id);

  const index = requestQueue.findIndex(function (r) {
    return r.id === id;
  });

  if (index === -1) {
    return res.status(404).json({ error: "Request not found" });
  }

  const removed = requestQueue.splice(index, 1)[0];
  writeJsonFile(QUEUE_PATH, requestQueue);

  res.json({ success: true, removed: removed });
});

app.delete("/api/queue", function (req, res) {
  requestQueue = [];
  writeJsonFile(QUEUE_PATH, requestQueue);
  res.json({ success: true });
});

app.get("/api/health", function (req, res) {
  res.json({
    ok: true,
    songs: knownSongs.length,
    queued: requestQueue.length
  });
});

app.listen(port, function () {
  console.log("Server running on http://localhost:" + port);
});
