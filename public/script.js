async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) {
    throw new Error(`HTTP ${r.status}`);
  }
  return r.json();
}

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function loadGames(steamId) {
  const status = document.getElementById("status");
  const list = document.getElementById("gameList");

  try {
    const games = await fetchJSON(`/api/games?steamid=${steamId}`);
    status.textContent = `Total: ${games.length} juegos`;
    list.innerHTML = "";

    for (const g of games) {
      const li = document.createElement("li");
      li.className = "item";

      li.innerHTML = `
        <div class="row">
          <div class="icon"><img src="${g.logo}"></img></div>
          <div class="name">${g.name}</div>
          <button class="btn btn-trailer">Ver tráiler</button>
          <button class="btn btn-details">Ver detalles</button>
        </div>
        <div class="trailer" id="trailer-${g.appid}" style="margin-top: 10px;" data-open="false"></div>
        <div class="details" id="d-${g.appid}">
          <div class="details-content">Cargando detalles…</div>
        </div>
      `;

      // Botón para mostrar trailer
      li.querySelector(".btn-trailer").addEventListener("click", async () => {
        const allTrailers = document.querySelectorAll(".trailer");
        const trailerContainer = li.querySelector(`#trailer-${g.appid}`);

        // Cierra todos los trailers excepto el actual
        allTrailers.forEach((tc) => {
          if (tc !== trailerContainer) {
            const iframe = tc.querySelector("iframe");
            if (iframe)
              iframe.contentWindow.postMessage(
                '{"event":"command","func":"pauseVideo","args":""}',
                "*"
              );
            const video = tc.querySelector("video");
            if (video) video.pause();
            tc.innerHTML = "";
            tc.dataset.open = "false";
          }
        });

        // Si ya estaba abierto, lo cerramos
        if (trailerContainer.dataset.open === "true") {
          const iframe = trailerContainer.querySelector("iframe");
          if (iframe)
            iframe.contentWindow.postMessage(
              '{"event":"command","func":"pauseVideo","args":""}',
              "*"
            );
          const video = trailerContainer.querySelector("video");
          if (video) video.pause();
          trailerContainer.innerHTML = "";
          trailerContainer.dataset.open = "false";
          return;
        }

        trailerContainer.innerHTML = "Cargando tráiler…";
        trailerContainer.dataset.open = "true";

        try {
          const d = await fetchJSON("/api/store/" + g.appid);

          if (!d.trailer || d.trailer.trim() === "") {
            trailerContainer.innerHTML =
              "<p>Este juego no tiene tráiler disponible.</p>";
            trailerContainer.dataset.open = "false";
            return;
          }

          if (d.trailer.includes("youtube.com/embed")) {
            // YouTube autoplay
            trailerContainer.innerHTML = `
              <iframe 
                src="${d.trailer}?enablejsapi=1&autoplay=1" 
                title="Tráiler de ${d.name}" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen>
              </iframe>
            `;
          } else {
            // Steam .webm o .mp4
            const ext = d.trailer.endsWith(".mp4") ? "mp4" : "webm";
            trailerContainer.innerHTML = `
              <video controls autoplay muted>
                <source src="${d.trailer}" type="video/${ext}">
                Tu navegador no soporta este formato de video.
              </video>
            `;
          }
        } catch (e) {
          trailerContainer.innerHTML = "<p>Error cargando tráiler.</p>";
          trailerContainer.dataset.open = "false";
          console.error(e);
        }
      });

      // Botón para mostrar detalles expandibles
      const detailsEl = li.querySelector(".details");
      const detailsBtn = li.querySelector(".btn-details");
      let loaded = false;

      detailsBtn.addEventListener("click", async () => {
        detailsEl.classList.toggle("open");

        if (!loaded && detailsEl.classList.contains("open")) {
          detailsEl.querySelector(".details-content").textContent =
            "Cargando detalles…";
          try {
            const d = await fetchJSON("/api/store/" + g.appid);
            const html = `
              <p>${d.description || "—"}</p>
              <p><strong>Precio:</strong> ${d.price || "N/A"}</p>
              <p><strong>Año:</strong> ${d.date || "N/A"}</p>
              ${
                Array.isArray(d.genres) && d.genres.length
                  ? "<div>" +
                    d.genres
                      .map((x) => `<span class="badge">${x}</span>`)
                      .join("") +
                    "</div>"
                  : ""
              }
            `;
            detailsEl.querySelector(".details-content").innerHTML = html;
            loaded = true;
          } catch (e) {
            detailsEl.querySelector(".details-content").textContent =
              "No se pudieron cargar los detalles.";
            console.error(e);
          }
        }
      });

      list.appendChild(li);
    }
  } catch (e) {
    status.textContent = "Mete to SteamID64 (Dec)... Upa.";
    console.error(e);
  }
}

// Evento del formulario
document.getElementById("steamForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const steamId = document.getElementById("steamIdInput").value.trim();
  if (steamId) {
    loadGames(steamId);
  }
});

loadGames();
