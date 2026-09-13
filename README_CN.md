# NeoPet AI 桌宠 + NeoAI 手机助手

电脑端继续提供透明置顶 AI 桌宠、原创角色、养成和记忆。移动端已经改为 NeoAI 手机助手：以对话、文件、语音、手机工具和模型中心为主，不再放置桌面宠物。两端都可连接 OpenAI 兼容 API 或局域网模型服务。

![小诺 v2 动作图集质检图](docs/xiaonuo-contact-sheet.png)

## 0.3.0 长期陪伴记忆

电脑版、PWA 与 Android 现在都具备本地长期记忆、关系成长、心情与连续陪伴天数、陪伴日记和主动问候。用户可查看并单独删除宠物记住的事情，也可导出 JSON 备份、导入恢复或彻底清除陪伴数据；API 密钥不会写入备份文件。记忆会作为受控上下文提供给自由选择的聊天模型，使宠物自然延续之前的相处内容。

## 0.4.0 本地 AI 运行时

Windows 版支持 Whisper Tiny 离线语音识别、Ollama + Gemma 3 1B 离线聊天和 pyttsx3 本地朗读。Kokoro 已预留独立提供器位置，并在尚未安装时安全回退到系统朗读。设置中的“检测本地组件”分别显示四个组件的状态。

普通用户可在设置中点击“应用内安装离线套件”；它会明确提示约 2.4GB 空间后，再从官方来源安装各组件。开发机也可运行：`powershell -ExecutionPolicy Bypass -File scripts/install-local-runtime.ps1`。

设计与质量文档：[架构](docs/ARCHITECTURE.md) · [性能](docs/PERFORMANCE.md) · [安全](docs/SECURITY.md) · [测试](docs/TESTING.md)

## 0.2.0 多宠物与 3D

电脑版保留小诺、云团、月狸、3D/导入角色和透明悬浮桌宠。自 0.7.0 起，移动端改为独立的 NeoAI 手机工作台，不再复用宠物舞台；这是面向手机任务效率的明确产品分工。

| Windows 悬浮模式 | Windows 展开模式 |
| --- | --- |
| ![Windows 悬浮模式](docs/desktop-compact-qa.png) | ![Windows 展开模式](docs/desktop-expanded-qa.png) |

设计参考与取舍见 [产品参考研究](docs/DESIGN_REFERENCES.md)。

## NeoAI 移动端

移动端源码在 `mobile/`，浏览器/PWA 支持 Android、iPhone、iPad。Android APK 额外内置 arm64 llama.cpp 推理引擎，用户可在应用的模型中心查看名称、大小、建议内存和语言能力，自主选择 Qwen3 GGUF 模型并在应用内下载、选择和离线使用，无需安装 Ollama。高级用户也能添加其他 HTTPS GGUF 直链。

```powershell
npm run mobile:serve
```

打开 `http://127.0.0.1:4173`。移动版包括会话历史、附件分析、语音输入与朗读、自由 API、局域网模型、手机工具、视频中心和离线应用外壳。PWA 不具备 Android 原生本地推理和跨 App 控制能力。

Android 工程位于 `android/`，打包时直接复用 `mobile/` 的页面资源。调试 APK 可通过 Android Studio 构建，或使用仓库内 Gradle Wrapper 执行 `android\\gradlew.bat -p android assembleDebug`。

### Android 本地模型、手机协助与权限

Android APK 的本机模型文件位于应用私有目录，卸载应用会一并删除。跨 App 协助默认关闭，用户必须在系统无障碍设置中手动开启，而且每次执行前仍需在 NeoAI 内确认。权限遵循按需申请：

- `INTERNET`：连接云端 API 或局域网本地模型，安装时自动授予。
- `RECORD_AUDIO`：只有用户主动使用语音输入时才申请；拒绝后仍可文字聊天。
- `CAMERA`：只有用户主动测试视频通话或拍照时才申请。
- 无障碍服务：系统单独授权，用于执行用户已确认的有限点击、输入、滚动和返回；密码、验证码、银行、支付和购买界面自动停止。

模型下载只接受 HTTPS，并检查文件名、大小与剩余空间；不申请读取全部存储空间。拨号和短信只打开系统编辑页，不会直接拨出或发送。

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
- 小诺、云团、月狸三只内置动作宠物保留在电脑端；移动端不加载桌宠素材。
- 导入本地或网络 GLB/GLTF 真 3D 宠物，支持触摸旋转和模型自带动画。
- 视频中心可载入本地视频、按当前时间添加弹幕、根据字幕用 AI 批量生成弹幕、翻译字幕并导出 VTT。
- 视频通话入口会先测试摄像头和麦克风，再创建可分享的加密 Jitsi 会议链接；摄像头权限只在用户点击测试时申请。
- 最近 30 条对话记忆、角色名字和性格设置。
- 可查看和单条遗忘的长期记忆、关系等级、心情、连续陪伴天数、陪伴日记与主动问候。
- 本地陪伴数据可备份、导入和彻底清除，备份不包含 API 密钥。
- Windows 安装包、便携版和 Android 调试 APK；代码保留 macOS DMG 与 Linux AppImage 配置。

## 开发运行

```powershell
npm install
npm test
npm start
```

开发环境默认直接显示测试验证码，不会连接真实 SMTP；需要在开发环境实际发送邮件时额外设置 `NEOPET_DEV_SEND_EMAIL=1`。正式安装包仍按 SMTP 配置发送邮件，不会显示开发验证码。

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
