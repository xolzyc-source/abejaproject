// Netlify Function: /netlify/functions/partidos.js
// Esconde la API key de api-football.com y sirve los datos al frontend.
// La key real se configura como variable de entorno en Netlify (FOOTBALL_API_KEY),
// nunca queda escrita en este archivo ni visible para el usuario.

exports.handler = async function (event) {
  const API_KEY = process.env.FOOTBALL_API_KEY;
  const BASE_URL = "https://v3.football.api-sports.io";

  if (!API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Falta configurar FOOTBALL_API_KEY en Netlify (Site settings > Environment variables)." }),
    };
  }

  // ?tipo=fixtures|standings|topscorers|lineups  controla qué endpoint se llama
  const tipo = event.queryStringParameters?.tipo || "fixtures";
  const league = event.queryStringParameters?.league || "1"; // 1 = Mundial en api-football
  const season = event.queryStringParameters?.season || "2026";
  const fixtureId = event.queryStringParameters?.fixture;

  let endpoint = "";
  if (tipo === "fixtures") {
    endpoint = `/fixtures?league=${league}&season=${season}&date=${new Date().toISOString().slice(0, 10)}`;
  } else if (tipo === "standings") {
    endpoint = `/standings?league=${league}&season=${season}`;
  } else if (tipo === "topscorers") {
    endpoint = `/players/topscorers?league=${league}&season=${season}`;
  } else if (tipo === "lineups" && fixtureId) {
    endpoint = `/fixtures/lineups?fixture=${fixtureId}`;
  } else if (tipo === "playerratings" && fixtureId) {
    endpoint = `/fixtures/players?fixture=${fixtureId}`;
  } else {
    return { statusCode: 400, body: JSON.stringify({ error: "Parámetro 'tipo' inválido o falta 'fixture'." }) };
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        "x-apisports-key": API_KEY,
      },
    });
    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30", // cachea 30s para no gastar requests de más
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error al consultar la API de fútbol.", detalle: err.message }),
    };
  }
};
