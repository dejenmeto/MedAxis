const crypto = require("node:crypto");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateToken() {
  return crypto.randomBytes(48).toString("hex");
}

function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(query.limit, 10) || 10),
  );

  return { page, limit, offset: (page - 1) * limit };
}

function paginationMeta(total, page, limit) {
  const count = Number(total);

  return {
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  };
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = {
  hashToken,
  generateToken,
  parsePagination,
  paginationMeta,
  asyncHandler,
};
