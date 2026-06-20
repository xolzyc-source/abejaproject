// Netlify Function: /netlify/functions/admin-login.js
// Verifica la clave del panel admin SIN exponerla nunca en el código del navegador.
// La clave real vive solo en una variable de entorno de Netlify (ADMIN_PASS),
// nunca en este archivo ni en ningún archivo que subas a GitHub.

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Método no permitido." }) };
  }

  const ADMIN_PASS = process.env.ADMIN_PASS;
  if (!ADMIN_PASS) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Falta configurar ADMIN_PASS en Netlify (Site settings > Environment variables)." }),
    };
  }

  let intento;
  try {
    const body = JSON.parse(event.body || "{}");
    intento = body.clave;
  } catch (err) {
    return { statusCode: 400, body: JSON.stringify({ error: "Solicitud inválida." }) };
  }

  const correcta = intento === ADMIN_PASS;

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: correcta }),
  };
};
