import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { check, validationResult } from "express-validator";
import sanitize from "express-sanitize-middleware";

dotenv.config();

const app = express();

// ✅ Load allowed origins from .env and trim spaces
const allowedOrigins = process.env.CORS.split(",").map(o => o.trim());

// ✅ Middleware: sanitize request body fields
app.use(sanitize({
  sanitize: {
    body: ["name", "email", "message"]
  }
}));

// ✅ CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST"],
  credentials: true
}));

// ✅ Rate limiting to prevent abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per 15 minutes
  message: "Too many requests, please try again after 15 minutes."
});

app.use(express.json());

// ✅ Nodemailer transporter setup
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // must be Gmail App Password
  },
});

// ✅ Verify transporter connection
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Nodemailer transporter error:", error.message);
  } else {
    console.log("✅ Nodemailer is ready to send emails!");
  }
});

// ✅ Routes
app.get("/", (req, res) => {
  res.send("Contact form API is running!");
});

app.post(
  "/connect",
  apiLimiter,
  [
    // ✅ Validation rules
    check("name").trim().notEmpty().withMessage("Name is required."),
    check("email").isEmail().normalizeEmail().withMessage("A valid email is required."),
    check("message").trim().notEmpty().withMessage("Message is required."),
  ],
  async (req, res) => {
    // ✅ Handle validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, message } = req.body;

    const mailOptions = {
      from: `"${name}" <${process.env.EMAIL_USER}>`,
      replyTo: email,
      to: process.env.EMAIL_TO,
      subject: `New Contact Form Submission from ${name}`,
      html: `
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong> ${message}</p>
      `,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log("✅ Email sent successfully! Message ID:", info.messageId);

      res.status(200).json({ message: "Message sent successfully!" });
    } catch (error) {
      console.error("❌ Error sending email:", error.message);
      res.status(500).json({ message: "Internal server error. Please try again later." });
    }
  }
);

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
