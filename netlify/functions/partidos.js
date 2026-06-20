// Netlify Function: /netlify/functions/partidos.js
// Trae datos reales del Mundial 2026 desde openfootball/worldcup.json
// (fuente pública, gratuita, sin necesidad de API key).
// Calculamos la tabla de grupos y goleadores nosotros mismos a partir
// de los resultados, porque la fuente solo trae el calendario de partidos.

const SOURCE_URL = "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";

let cache = { data: null, fetchedAt: 0 };
const CACHE_MS = 5 * 60 * 1000; // 5 minutos, para no golpear GitHub en cada visita

async function obtenerDatosFuente() {
  const ahora = Date.now();
  if (cache.data && (ahora - cache.fetchedAt) < CACHE_MS) {
    return cache.data;
  }
  const res = await fetch(SOURCE_URL);
  const json = await res.json();
  cache = { data: json, fetchedAt: ahora };
  return json;
}

function construirFixtures(matches) {
  return matches
    .filter(m => m.score) // solo partidos que ya se jugaron (tienen resultado)
    .map((m, i) => ({
      id: `${m.group || m.round}-${m.team1}-${m.team2}`.replace(/\s+/g, '_'),
      teamA: m.team1,
      teamB: m.team2,
      scoreA: m.score.ft ? m.score.ft[0] : null,
      scoreB: m.score.ft ? m.score.ft[1] : null,
      status: 'Finalizado',
      minute: m.date,
      group: m.group || m.round,
      goalsA: m.goals1 || [],
      goalsB: m.goals2 || [],
    }));
}

function construirProximos(matches) {
  return matches
    .filter(m => !m.score)
    .map(m => ({
      id: `${m.group || m.round}-${m.team1}-${m.team2}`.replace(/\s+/g, '_'),
      teamA: m.team1,
      teamB: m.team2,
      status: 'Programado',
      minute: `${m.date} ${m.time || ''}`.trim(),
      group: m.group || m.round,
    }));
}

function construirStandings(matches) {
  const tabla = {}; // { "Group A": { "Mexico": {pj,g,e,p,gf,gc,pts}, ... } }

  matches.forEach(m => {
    if (!m.group || !m.score || !m.score.ft) return;
    const [golesA, golesB] = m.score.ft;
    const grupo = m.group;
    tabla[grupo] = tabla[grupo] || {};

    [m.team1, m.team2].forEach(equipo => {
      if (!tabla[grupo][equipo]) {
        tabla[grupo][equipo] = { team: equipo, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 };
      }
    });

    const eqA = tabla[grupo][m.team1];
    const eqB = tabla[grupo][m.team2];

    eqA.pj++; eqB.pj++;
    eqA.gf += golesA; eqA.gc += golesB;
    eqB.gf += golesB; eqB.gc += golesA;

    if (golesA > golesB) { eqA.g++; eqA.pts += 3; eqB.p++; }
    else if (golesA < golesB) { eqB.g++; eqB.pts += 3; eqA.p++; }
    else { eqA.e++; eqB.e++; eqA.pts += 1; eqB.pts += 1; }
  });

  // Aplanamos a un solo arreglo, ordenado por grupo y puntos
  const resultado = [];
  Object.keys(tabla).sort().forEach(grupo => {
    const equipos = Object.values(tabla[grupo]).sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc));
    equipos.forEach(eq => resultado.push({ ...eq, group: grupo }));
  });
  return resultado;
}

function construirGoleadores(matches) {
  const goleadores = {}; // { "Lionel Messi": { team, goals } }

  matches.forEach(m => {
    if (!m.score) return;
    (m.goals1 || []).forEach(g => {
      if (g.owngoal) return; // autogoles no cuentan como goleador
      goleadores[g.name] = goleadores[g.name] || { name: g.name, team: m.team1, goals: 0 };
      goleadores[g.name].goals++;
    });
    (m.goals2 || []).forEach(g => {
      if (g.owngoal) return;
      goleadores[g.name] = goleadores[g.name] || { name: g.name, team: m.team2, goals: 0 };
      goleadores[g.name].goals++;
    });
  });

  return Object.values(goleadores).sort((a, b) => b.goals - a.goals);
}

exports.handler = async function (event) {
  const tipo = event.queryStringParameters?.tipo || "fixtures";

  try {
    const fuente = await obtenerDatosFuente();
    const matches = fuente.matches || [];

    let payload;
    if (tipo === "fixtures") {
      payload = construirFixtures(matches);
    } else if (tipo === "proximos") {
      payload = construirProximos(matches);
    } else if (tipo === "standings") {
      payload = construirStandings(matches);
    } else if (tipo === "topscorers") {
      payload = construirGoleadores(matches);
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: "Parámetro 'tipo' inválido. Usa: fixtures, proximos, standings o topscorers." }) };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
      body: JSON.stringify({ response: payload }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error al consultar los datos del Mundial.", detalle: err.message }),
    };
  }
};

