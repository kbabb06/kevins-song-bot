const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const SONGS_PATH = path.join(__dirname, "songs.json");
const QUEUE_PATH = path.join(__dirname, "queue.json");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

app.post("/api/song-bot", async function (req, res) {
  try {
    const requestText = String(req.body.request || "").trim();

    if (!requestText) {
      return res.status(400).json({ error: "Request is required" });
    }

    const songCatalog = knownSongs.map(function (entry, index) {
      return (index + 1) + ". " + entry.song + " - " + entry.artist;
    }).join("\n");

    const systemPrompt = [
      "You are helping a live musician respond to audience song requests.",
      "You may ONLY choose songs from the provided catalog.",
      "Do not invent songs.",
      "Choose the best 3 to 5 matches based on vibe, genre, era, artist similarity, mood, tempo, or theme.",
      "Return ONLY valid JSON in exactly this shape:",
      '{',
      '  "reply": "short friendly sentence",',
      '  "matches": [1, 2, 3]',
      '}',
      "The numbers in matches must be catalog line numbers from the SONG CATALOG below.",
      "If nothing fits, return an empty matches array.",
      "",
      "SONG CATALOG:",
      songCatalog
    ].join("\n");

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: requestText }
      ]
    });

    const raw = completion.choices[0].message.content;
    const parsed = JSON.parse(raw);

    let suggestions = [];

    if (Array.isArray(parsed.matches)) {
      suggestions = parsed.matches
        .map(function (n) {
          const index = Number(n) - 1;
          return knownSongs[index];
        })
        .filter(function (item) {
          return item && item.song;
        })
        .slice(0, 5);
    }

    // fallback local search if AI returns nothing
    if (!suggestions.length) {
      const q = requestText.toLowerCase();

      suggestions = knownSongs.filter(function (entry) {
        return (
          entry.song.toLowerCase().includes(q) ||
          entry.artist.toLowerCase().includes(q) ||
          entry.full.toLowerCase().includes(q)
        );
      }).slice(0, 5);
    }

    res.json({
      reply: String(parsed.reply || "Here are a few ideas from my setlist."),
      suggestions: suggestions
    });
  } catch (err) {
    console.error("Song bot error:", err);
    res.status(500).json({ error: "Song bot failed" });
  }
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