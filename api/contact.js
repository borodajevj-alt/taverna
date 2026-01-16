import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false });
  }

  try {
    const {
      lang = "ENG",
      name,
      email,
      budget,
      title,
      details,
      id
    } = req.body;

    // === Zoho SMTP ===
    const transporter = nodemailer.createTransport({
      host: "smtp.zoho.eu",
      port: 465,
      secure: true,
      auth: {
        user: "info@designtaverna.com",
        pass: process.env.ZOHO_MAIL_PASS
      }
    });

    // письмо ТЕБЕ
    await transporter.sendMail({
      from: `"DesignTaverna" <info@designtaverna.com>`,
      to: "info@designtaverna.com",
      subject: `[${lang}] #${id} — ${title}`,
      text: `
Name: ${name}
Email: ${email}
Budget: ${budget}

${details}
      `
    });

    // автоответ КЛИЕНТУ
    await transporter.sendMail({
      from: `"DesignTaverna" <info@designtaverna.com>`,
      to: email,
      subject: `DesignTaverna — we received your message (#${id})`,
      text: `
Hi ${name},

We received your message.
Request ID: #${id}

We’ll reply within 24 hours.

— DesignTaverna
      `
    });

    return res.json({ ok: true });

  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
