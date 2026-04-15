const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fs = require("fs");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const songsData = JSON.parse(fs.readFileSync("./songs.json", "utf8"));

const knownSongs = songsData.map(function (entry) {
  const song = String(entry.song || "").trim();
  const artist = String(entry.artist || "").trim();
  return {
    song: song,
    artist: artist,
    full: song + " - " + artist
  };
});

// SIMPLE IN-MEMORY QUEUE
let requestQueue = [];

// VIEW QUEUE
app.get("/api/queue", function (req, res) {
  res.json(requestQueue);
});

// ADD TO QUEUE
app.post("/api/queue", function (req, res) {
  const song = req.body.song;
  const artist = req.body.artist;

  if (!song) {
    return res.status(400).json({ error: "Song required" });
  }

  const newRequest = {
    song: song,
    artist: artist,
    time: new Date().toISOString()
  };

  requestQueue.push(newRequest);

  console.log("NEW REQUEST:", newRequest);

  res.json({ success: true });
});

// SEARCH SONGS
app.get("/api/songs", function (req, res) {
  const q = String(req.query.q || "").toLowerCase();

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

app.listen(port, function () {
  console.log("Server running on http://localhost:" + port);
});
