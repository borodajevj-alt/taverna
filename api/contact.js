import nodemailer from "nodemailer";

const SCRIPT_URL = process.env.SCRIPT_URL; // Apps Script /exec
const TO_EMAIL   = process.env.TO_EMAIL;   // info@designtaverna.com
const ZOHO_USER  = process.env.ZOHO_USER;  // info@designtaverna.com
const ZOHO_PASS  = process.env.ZOHO_PASS;  // app password
const ZOHO_HOST  = process.env.ZOHO_HOST || "smtp.zoho.eu";
const ZOHO_PORT  = Number(process.env.ZOHO_PORT || "465");

function safeLang(lang) {
  const v = String(lang || "").toUpperCase();
  return (v === "RU" || v === "ENG" || v === "EE" || v === "LV") ? v : "ENG";
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function clientCopy(lang, name, idStr, title) {
  const L = safeLang(lang);

  if (L === "RU") return {
    subject: `designTaverna — мы получили ваше сообщение (${idStr})`,
    body:
`Привет, ${name}!

Спасибо за обращение в designTaverna 👋
Мы получили ваше сообщение и уже взяли его в работу.

⏱ Ответим в течение 24 часов
📌 Номер заявки: ${idStr}
📝 Тема: ${title}

Это автоматическое письмо — отвечать не нужно.
Если вы всё же ответите, письмо придёт в нашу команду.

— designTaverna
Riga • Tallinn • London
info@designtaverna.com`
  };

  if (L === "EE") return {
    subject: `designTaverna — saime sinu sõnumi kätte (${idStr})`,
    body:
`Tere, ${name}!

Aitäh, et kirjutasid designTaverna’le 👋
Sinu sõnum on kätte saadud ja vaatame selle peagi üle.

⏱ Vastame 24 tunni jooksul
📌 Päringu ID: ${idStr}
📝 Teema: ${title}

See on automaatne kinnitus — palun ära vasta sellele kirjale.
Kui vastad, jõuab kiri meie tiimini.

— designTaverna
Riga • Tallinn • London
info@designtaverna.com`
  };

  if (L === "LV") return {
    subject: `designTaverna — saņēmām jūsu ziņu (${idStr})`,
    body:
`Sveiki, ${name}!

Paldies, ka sazinājāties ar designTaverna 👋
Mēs saņēmām jūsu ziņu un drīzumā to izskatīsim.

⏱ Atbildēsim 24 stundu laikā
📌 Pieteikuma ID: ${idStr}
📝 Tēma: ${title}

Šis ir automātisks apstiprinājums — lūdzu neatbildiet uz šo e-pastu.
Ja atbildēsiet, ziņa nonāks mūsu komandai.

— designTaverna
Riga • Tallinn • London
info@designtaverna.com`
  };

  return {
    subject: `designTaverna — we received your message (${idStr})`,
    body:
`Hi ${name},

Thank you for contacting designTaverna 👋
We’ve received your message and will review it shortly.

⏱ Expected response time: within 24 hours
📌 Request ID: ${idStr}
📝 Subject: ${title}

This is an automated confirmation — please do not reply to this email.
If you reply anyway, your message will reach our team.

— designTaverna
Riga • Tallinn • London
info@designtaverna.com`
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Use POST" });

  try {
    const body = req.body || {};
    const lang = safeLang(body.lang);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const budget = String(body.budget || "").trim();
    const title = String(body.title || "").trim();
    const details = String(body.details || "").trim();
    const page = String(body.page || "").trim();
    const ua = String(body.ua || "").trim();

    if (!name || !email || !title || !details) return res.status(400).json({ ok:false, error:"Missing required fields" });
    if (!isValidEmail(email)) return res.status(400).json({ ok:false, error:"Invalid email" });

    // 1) получить ID + записать в Sheet
    const sheetResp = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lang, name, email, budget, title, details, page, ua })
    });
    const sheetJson = await sheetResp.json();
    if (!sheetJson?.ok) return res.status(500).json({ ok:false, error: sheetJson?.error || "Sheet error" });

    const id = sheetJson.id;
    const idStr = `#${id}`;

    // 2) SMTP Zoho
    const transporter = nodemailer.createTransport({
      host: ZOHO_HOST,
      port: ZOHO_PORT,
      secure: ZOHO_PORT === 465,
      auth: { user: ZOHO_USER, pass: ZOHO_PASS }
    });

    // 3) письмо ТЕБЕ (Reply-To = клиент)
    await transporter.sendMail({
      from: `designTaverna <${ZOHO_USER}>`,
      to: TO_EMAIL,
      subject: `[${lang}] ${idStr} — ${title}`,
      text:
`New lead received

ID: ${id}
Language: ${lang}
Title: ${title}

Name: ${name}
Email: ${email}
Budget (EUR): ${budget || "-"}

Details:
${details}

Page: ${page || "-"}
UA: ${ua || "-"}`,
      replyTo: email
    });

    // 4) автоответ клиенту (Reply-To = ты)
    const cc = clientCopy(lang, name, idStr, title);
    await transporter.sendMail({
      from: `designTaverna <${ZOHO_USER}>`,
      to: email,
      subject: cc.subject,
      text: cc.body,
      replyTo: TO_EMAIL
    });

    return res.status(200).json({ ok:true, id });
  } catch (e) {
    return res.status(500).json({ ok:false, error:String(e) });
  }
}
