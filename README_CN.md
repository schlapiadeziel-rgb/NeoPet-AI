# NeoPet AI 桌面端与移动端

NeoPet AI 是一个跨电脑与移动设备的 AI 宠物。电脑端提供透明置顶桌宠，移动端提供可安装 PWA；两端都可连接 OpenAI 兼容 API，也可以把 API 地址改成本机 `llama-server` 等兼容服务。

![小诺 v2 动作图集质检图](docs/xiaonuo-contact-sheet.png)

## 移动端

移动端源码在 `mobile/`，可安装到 Android、iPhone、iPad 和支持 PWA 的桌面浏览器。

```powershell
npm run mobile:serve
```

打开 `http://127.0.0.1:4173`。移动版包括自适应宠物、触摸互动、闲置动作、语音输入与朗读、自由模型配置、自定义图片和离线应用外壳。Android 原生悬浮层与 iOS WidgetKit 是平台增强层，不属于网页权限范围。

Android 工程位于 `android/`，打包时直接复用 `mobile/` 的页面资源。调试 APK 可通过 Android Studio 构建，或使用仓库内 Gradle Wrapper 执行 `android\\gradlew.bat -p android assembleDebug`。

## 桌面宠物交互

- 登录成功后默认进入透明宠物模式，不持续占用大聊天窗口。
- 默认宠物“小诺”使用 8×11、共 88 格的 v2 动作图集；包含九类标准动作和 16 向鼠标注视，按实际显示尺寸逐帧校验。
- 拖动宠物可移动位置；单击互动；双击展开聊天；右键打开设置。
- 宠物闲置时会随机挥手、点头、活动或跳舞，长时间无操作后睡觉。
- 倾听、思考和回答具有不同动作，语音回答期间带口型动画。
- `Ctrl+Shift+Space` 或系统托盘菜单可随时打开完整聊天面板。

## 已实现

- 邮箱验证码登录，验证码 5 分钟有效，60 秒发送限流，最多尝试 5 次。
- Windows 透明置顶窗口、系统托盘、全局快捷键和鼠标穿透。
- 完整与精简两种窗口模式，宠物可直接拖动。
- 空闲、左右移动、聆听、思考、说话、开心、挥手、点头、跳舞和睡眠动作。
- 鼠标在宠物周围移动时，眼睛和天线会按 16 个方向连续跟随。
- AI 回答返回情绪及动作，语音朗读时同步口型和对应动作。
- OpenAI 兼容聊天 API，可自由填写服务地址和模型名称。
- 本地兼容服务可以不填写 API 密钥；云端服务按供应商要求填写。
- API 密钥使用 Electron `safeStorage` 和操作系统凭据能力加密保存。
- 系统语音朗读、语速和声音选择；支持时启用系统语音识别。
- 可指定中文、英语、日语、韩语，或跟随输入自动识别。
- AI 生成原创宠物，或导入 PNG、WebP、JPG 图片。
- 最近 30 条对话记忆、角色名字和性格设置。
- Windows 安装包和便携版打包；代码保留 macOS DMG 与 Linux AppImage 配置。

## 开发运行

```powershell
npm install
npm test
npm start
```

开发环境未配置 SMTP 时，验证码会显示在登录页，仅用于本地测试。正式安装包不会显示开发验证码。

## 邮箱验证码

当前个人测试可使用 QQ 邮箱 SMTP。启动前设置：

```powershell
$env:NEOPET_SMTP_HOST='smtp.qq.com'
$env:NEOPET_SMTP_PORT='465'
$env:NEOPET_SMTP_USER='发件邮箱'
$env:NEOPET_SMTP_PASS='QQ邮箱SMTP授权码'
$env:NEOPET_ALLOWED_EMAILS='可选测试白名单，多个邮箱用逗号分隔'
npm start
```

`NEOPET_SMTP_PASS` 使用 SMTP 授权码，不是邮箱登录密码。未设置 `NEOPET_ALLOWED_EMAILS` 时允许任何格式有效的邮箱请求验证码。面向公众发布时应把验证码发送和账号会话迁移到服务端，不能把 SMTP 凭据分发到客户端。

## AI 设置

打开设置后填写：

- API 地址，例如 `https://api.openai.com/v1`，也可以填写本机兼容服务地址。
- 聊天模型名称。
- 图像模型名称，仅生成宠物时需要。
- API 密钥。

聊天接口使用 `/chat/completions`，图像生成使用 `/images/generations`。不同服务商支持的模型和图像参数可能不同。

## Windows 快捷操作

- `Ctrl+Shift+Space`：显示桌宠并打开聊天。
- 点击宠物：摸头互动。
- 拖动宠物：移动整个桌宠窗口。
- 托盘菜单：显示、打开聊天、鼠标穿透或退出。

## 构建

```powershell
npm run pack:win
```

输出位于 `dist`：

- NSIS 安装程序。
- Windows 便携版。

## 产品边界

- 电影和动画可作为风格、色彩和氛围灵感，但不应直接复制受版权保护的角色造型、名称或声音。
- 当前记忆保存在本机。多设备同步需要后续账号服务。
- Windows 是首个验证平台；macOS 和 Linux 需要在对应系统上完成签名、权限和打包验证。
