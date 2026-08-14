const test = require("node:test");
const assert = require("node:assert/strict");
const { OtpService } = require("../src/main/auth");

test("development OTP verifies once", async () => {
  const service = new OtpService({ development: true });
  const result = await service.request("qa@example.com");
  assert.match(result.developmentCode, /^\d{6}$/);
  assert.equal(service.verify("QA@example.com", result.developmentCode), "qa@example.com");
  assert.throws(() => service.verify("qa@example.com", result.developmentCode), /先发送验证码/);
});

test("rejects invalid email", async () => {
  const service = new OtpService({ development: true });
  await assert.rejects(service.request("not-an-email"), /有效邮箱/);
});

test("rejects an incorrect code", async () => {
  const service = new OtpService({ development: true });
  await service.request("qa2@example.com");
  assert.throws(() => service.verify("qa2@example.com", "000000"), /不正确/);
});
