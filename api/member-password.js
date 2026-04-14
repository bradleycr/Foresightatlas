"use strict";

const { changeDirectoryPassword } = require("../server/directory-auth");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const token =
      req.body?.token ||
      (typeof req.headers.authorization === "string"
        ? req.headers.authorization.replace(/^Bearer\s+/i, "")
        : "");

    const result = await changeDirectoryPassword(
      token,
      req.body?.currentPassword,
      req.body?.newPassword,
    );

    return res.status(200).json(result);
  } catch (error) {
    const status =
      error && typeof error === "object" && error.statusCode === 401 ? 401 : 400;
    return res.status(status).json({
      error:
        error instanceof Error ? error.message : "Failed to change password",
    });
  }
};
