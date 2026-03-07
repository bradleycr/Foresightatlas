"use strict";

const { authenticateDirectoryLogin } = require("../server/directory-auth");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const result = await authenticateDirectoryLogin(
      req.body?.username,
      req.body?.password,
    );
    return res.status(200).json(result);
  } catch (error) {
    return res.status(401).json({
      error: error instanceof Error ? error.message : "Sign-in failed",
    });
  }
};
