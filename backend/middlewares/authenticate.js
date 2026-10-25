const jwt = require("jsonwebtoken");
const { asyncHandler } = require("../utils/helpers");

const authenticate = asyncHandler(async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication is required.",
    });
  }

  const token = authorization.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "medaxis-api",
      audience: "medaxis-web",
    });

    req.user = {
      id: String(payload.sub),
      role: payload.role,
      hospitalId: payload.hospitalId ? String(payload.hospitalId) : null,
    };

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Your access token is invalid or expired.",
    });
  }
});

module.exports = authenticate;
