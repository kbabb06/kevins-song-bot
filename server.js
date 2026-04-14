const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const OpenAI = require("openai");
const path = require("path");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const knownSongs = [
  "3am",
  "93 Million Miles",
  "Alive",
  "All Right Now",
  "Amber",
  "Apologize",
  "April 29th, 1992",
  "Are You In",
  "Badfish",
  "Basket Case",
  "Be My Mistake",
  "Behind Blue Eyes",
  "Better Together",
  "Beverly Hills",
  "Body Is A Wonderland",
  "Bold As Love",
  "Boys Of Summer",
  "Breakdown",
  "Breakeven",
  "Brick",
  "Brown Eyed Girl",
  "Bubbly Toes",
  "California",
  "Can’t Get Enough of You Baby",
  "Can’t Stop Thinking Bout You",
  "Can’t You See",
  "Cats In The Cradle",
  "Caught By The River",
  "Champagne Supernova",
  "Clocks",
  "Closing Time",
  "Collide / You’re Beautiful",
  "Come As You Are",
  "Come On Get Higher",
  "Come When I Call",
  "Crash Into Me",
  "Creep",
  "Cruel To Be Kind",
  "Dancing With A Stranger",
  "Daughters",
  "December",
  "Devil In Disguise",
  "Diamonds On The Inside",
  "Dirty Little Secret",
  "Doesn’t Remind Me",
  "Doin Time",
  "Drain You",
  "Dreams",
  "Drift Away",
  "Drive",
  "Drops of Jupiter",
  "Electric Feel",
  "Escape(Pina Colada)",
  "Far Away",
  "Feel Like Making Love",
  "Feeling This",
  "Fire And Rain",
  "Fly Like An Eagle",
  "Fly Me To The Moon",
  "Folsom Prison Blues",
  "Fortunate Fool",
  "Freak Train",
  "Free Fallin",
  "Friends In Low Places",
  "Get Lucky",
  "Give Me One Reason",
  "Glory Bound",
  "Glycerine",
  "Good Love Is On The Way",
  "Good People",
  "Good Riddance",
  "Got You Where I Want You",
  "Gravity",
  "Half Of My Heart",
  "Hallelujah",
  "Halo",
  "Hand In My Pocket",
  "Hear You Me",
  "Heart Shaped Box",
  "Heartbreak Warfare",
  "Hey Joe",
  "Hey Jude",
  "Hey There Delilah",
  "Hey Ya",
  "High And Dry",
  "Honky Tonk Woman",
  "How’s It Gonna Be",
  "Hurts So Good",
  "Hysteria",
  "I Am The Highway",
  "I Don’t Trust Myself Loving You",
  "I Got A Woman",
  "I Got You",
  "I Miss You",
  "I Want You To Want Me",
  "I Was Wrong",
  "I Won’t Back Down",
  "I Won’t Give Up",
  "If It Makes You Happy",
  "In Your Atmosphere",
  "Ironic",
  "Island In The Sun",
  "It’s Been Awhile",
  "Jumper",
  "Just Like Heaven",
  "Just The Girl",
  "Kiss From A Rose",
  "Knockin On Heaven’s Door",
  "Lake Of Fire",
  "Landslide",
  "Lay Down Sally",
  "Lean On Me",
  "Let Her Go",
  "Little Lion Man",
  "Longview",
  "Love Song",
  "Mad World",
  "Mary Jane’s Last Dance",
  "My Girl",
  "No Diggity",
  "Nothing Else Matters",
  "One Love",
  "Otherside",
  "Paper Doll",
  "Panama",
  "Perfect",
  "Pina Coladas",
  "Pompeii",
  "Possum Kingdom",
  "Pumped Up Kicks",
  "Radioactive",
  "Ring Of Fire",
  "Rock With You",
  "Rooster",
  "Royals",
  "Rude",
  "Santeria",
  "Santa Monica",
  "Save Tonight",
  "Scar Tissue",
  "Sex And Candy",
  "Sex On Fire",
  "She Sells Sanctuary",
  "Shine",
  "Simple Man",
  "Slide",
  "Smoke Two Joints",
  "Somebody I Used To Know",
  "Soul To Squeeze",
  "Stand By Me",
  "Steal My Kisses",
  "Suit and Tie",
  "Sunday Bloody Sunday",
  "Sweet Child O’ Mine",
  "Sweet Pea",
  "Take Me To Church",
  "The Joker",
  "The Remedy",
  "The Warmth",
  "The World I Know",
  "Thinking Out Loud",
  "Time Of Your Life",
  "Tonight Tonight",
  "Under The Bridge",
  "Use Me",
  "Use Somebody",
  "Valerie",
  "Waiting On The World To Change",
  "Watch The Wind Blow By",
  "We’re Going To Be Friends",
  "What I Got",
  "What I Like About You",
  "What’s Up",
  "Where Did I Go Wrong",
  "Who Did You Think I Was",
  "Why Georgia",
  "Wind Cries Mary",
  "Wish You Were Here",
  "With Or Without You",
  "Wonderful Tonight",
  "Wonderwall",
  "You Don’t Know How It Feels",
  "You Really Got Me",
  "Young At Heart"
];

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/song-request", async (req, res) => {
  try {
    const { request } = req.body;

    if (!request || !request.trim()) {
      return res.status(400).json({
        error: "Please enter a song request."
      });
    }

    const prompt = `
You are an expert live musician helping choose songs for a crowd.

Your job is to interpret a customer's request, which may be vague like "chill acoustic", "something like John Mayer", or "upbeat 90s", and recommend the best songs from a fixed list.

Customer request:
"${request}"

Known songs:
${knownSongs.join(", ")}

Return ONLY valid JSON in this exact format:
{
  "matches": ["song1", "song2", "song3"],
  "message": "short, natural explanation"
}

Rules:
- Only choose songs from the known songs list
- Return 1 to 5 songs
- Prioritize songs that match the vibe, not just keywords
- Prioritize songs that are recognizable and engaging for a live audience
- Prioritize songs that would realistically be played next in a set
- Avoid random or weak matches
- If the request is vague, choose strong crowd-pleasers that fit
- The message should feel casual and natural, not robotic
- Do not include markdown
- Do not include any text outside the JSON
`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7
    });

    const raw = response.choices[0].message.content;
    console.log("RAW AI RESPONSE:", raw);

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return res.status(500).json({
        error: "Bad AI response format.",
        raw
      });
    }

    res.json(parsed);
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      error: "Something went wrong.",
      details: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});