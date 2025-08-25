import express from "express";
import dotenv from "dotenv";
dotenv.config();
import fetch from "node-fetch"; // Opcional en Node 24+, puedes usar fetch nativo

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

app.get("/api/games", async (req, res) => {
  try {
    const { STEAM_API_KEY, STEAM_ID } = process.env;
    if (!STEAM_API_KEY) {
      return res.status(400).json({ error: "Missing STEAM_API_KEY in .env" });
    }
    const steamid = req.query.steamid || STEAM_ID;
    if (!steamid) {
      return res.status(400).json({ error: "Missing steamid" });
    }
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${STEAM_API_KEY}&steamid=${steamid}&include_appinfo=true`;
    const resp = await fetch(url);
    if (!resp.ok)
      return res
        .status(resp.status)
        .json({ error: `Steam API error (${resp.status})` });
    const data = await resp.json();
    const games = (data?.response?.games || []).map((g) => ({
      appid: g.appid,
      name: g.name,
      logo: `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`,
    }));
    res.json(games);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch games" });
  }
});

app.get("/api/store/:appid", async (req, res) => {
  try {
    const { appid } = req.params;
    const storeUrl = `https://store.steampowered.com/api/appdetails?appids=${appid}`;
    const r = await fetch(storeUrl);
    const text = await r.text();

    if (text.trim().startsWith("<")) {
      return res
        .status(429)
        .json({ error: "Steam rate-limited or blocked this request" });
    }

    const json = JSON.parse(text);
    const d = json?.[appid]?.data;
    if (!d) return res.status(404).json({ error: "No store data" });

    // 1️⃣ Intentamos trailer de Steam
    let trailer = d.movies?.[0]?.webm?.max || null;

    // 2️⃣ Si no hay trailer en Steam, buscamos en YouTube
    const YT_KEY = process.env.YOUTUBE_API_KEY;
    if (!trailer && YT_KEY) {
      try {
        const query = encodeURIComponent(
          `"${d.name}" game trailer` + d.release_date.date.split(",")[1]
        );
        const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${query}&key=${YT_KEY}`;
        const ytResp = await fetch(ytUrl);
        if (ytResp.ok) {
          const ytData = await ytResp.json();
          const firstItem = ytData.items?.[0];
          const videoId = firstItem?.id?.videoId;
          if (videoId) {
            trailer = `https://www.youtube.com/embed/${videoId}`;
          } else {
            console.log("No se encontró video de YouTube válido para:", d.name);
          }
        } else {
          console.error(
            "Error YouTube API:",
            ytResp.status,
            await ytResp.text()
          );
        }
      } catch (e) {
        console.error("Error buscando trailer en YouTube:", e);
      }
    }

    const details = {
      appid,
      name: d.name,
      trailer,
      description: d.short_description || "—",
      date: d.release_date.date.split(",")[1],
      price: d.is_free ? "Free" : d.price_overview?.final_formatted || "N/A",
      genres: Array.isArray(d.genres) ? d.genres.map((g) => g.description) : [],
    };

    res.json(details);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to fetch store details" });
  }
});

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
