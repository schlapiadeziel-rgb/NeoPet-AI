const crypto = require("node:crypto");
const nodemailer = require("nodemailer");

class OtpService {
  constructor({ development = false } = {}) {
    this.development = development;
    this.pending = new Map();
  }

  normalizeEmail(email) {
    const value = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("请输入有效邮箱");
    return value;
  }

  digest(code, salt) {
    return crypto.createHash("sha256").update(`${salt}:${code}`).digest("hex");
  }

  async request(email) {
    const target = this.normalizeEmail(email);
    const existing = this.pending.get(target);
    if (existing && Date.now() - existing.sentAt < 60_000) throw new Error("请等待 60 秒后再次发送");
    const allowed = String(process.env.NEOPET_ALLOWED_EMAILS || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
    if (allowed.length && !allowed.includes(target)) throw new Error("该邮箱不在当前测试名单中");

    const code = String(crypto.randomInt(100000, 1000000));
    const salt = crypto.randomBytes(16).toString("hex");
    this.pending.set(target, {
      digest: this.digest(code, salt),
      salt,
      sentAt: Date.now(),
      expiresAt: Date.now() + 5 * 60_000,
      attempts: 0
    });

    const host = process.env.NEOPET_SMTP_HOST || "smtp.qq.com";
    const user = process.env.NEOPET_SMTP_USER || "";
    const pass = process.env.NEOPET_SMTP_PASS || "";
    if (this.development && process.env.NEOPET_DEV_SEND_EMAIL !== "1") {
      return { sent: false, developmentCode: code };
    }
    if (!user || !pass) {
      if (this.development) return { sent: false, developmentCode: code };
      this.pending.delete(target);
      throw new Error("邮件服务尚未配置，请设置 NEOPET_SMTP_USER 和 NEOPET_SMTP_PASS");
    }

    const port = Number(process.env.NEOPET_SMTP_PORT || 465);
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
    try {
      await transporter.sendMail({
        from: `NeoPet AI <${user}>`,
        to: target,
        subject: "NeoPet AI 登录验证码",
        text: `你的登录验证码是 ${code}，5 分钟内有效。请勿把验证码告诉他人。`,
        html: `<div style="font-family:system-ui;padding:24px"><h2>NeoPet AI</h2><p>你的登录验证码：</p><p style="font-size:30px;font-weight:700;letter-spacing:8px">${code}</p><p>5 分钟内有效，请勿把验证码告诉他人。</p></div>`
      });
      return { sent: true };
    } catch (error) {
      this.pending.delete(target);
      throw new Error(`验证码发送失败：${error.message}`);
    }
  }

  verify(email, code) {
    const target = this.normalizeEmail(email);
    const item = this.pending.get(target);
    if (!item) throw new Error("请先发送验证码");
    if (Date.now() > item.expiresAt) {
      this.pending.delete(target);
      throw new Error("验证码已过期");
    }
    item.attempts += 1;
    if (item.attempts > 5) {
      this.pending.delete(target);
      throw new Error("尝试次数过多，请重新发送验证码");
    }
    const candidate = this.digest(String(code || "").trim(), item.salt);
    const valid = crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(item.digest));
    if (!valid) throw new Error("验证码不正确");
    this.pending.delete(target);
    return target;
  }
}

module.exports = { OtpService };
