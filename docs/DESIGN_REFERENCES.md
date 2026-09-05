# NeoPet AI 产品参考研究

调研日期：2026-08-20。这里只提炼交互原则，不复制其他产品的角色、素材、文案或受保护设计。

## 参考作品

| 产品 | 当前公开信号 | 值得借鉴 | NeoPet 的取舍 |
| --- | --- | --- | --- |
| [VPet-Simulator](https://store.steampowered.com/app/1920960/VPet/) | Steam 英文评价约 95% 好评，全部语言超过 5 万条评价 | 大量动作、直接触摸、拖动和可扩展角色内容 | 增强动作丰富度和直接反馈，但保持界面更轻量 |
| [Finch](https://play.google.com/store/apps/details?id=com.finch.finch) | Google Play 约 4.9 分、数十万评价、千万级下载 | 同一个角色贯穿目标、反馈和长期陪伴 | 保持角色、状态和反馈跨端一致，不引入压力型养成 |
| [Desktop Mate](https://store.steampowered.com/app/3301060/Desktop_Mate/) | 活跃维护的商业桌宠产品 | 角色贴近桌面环境、追随鼠标、可缩放且不打扰工作 | 保留透明置顶、鼠标注视和紧凑悬浮模式 |
| [Open-LLM-VTuber](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber) | 活跃的开源 AI 角色项目 | 桌宠模式与完整聊天模式切换、多模型、语音和情绪映射 | 采用同一角色核心的双模式，不绑定单一模型供应商 |
| [My Talking Tom 2](https://play.google.com/store/apps/details?id=com.outfit7.mytalkingtom2) | Google Play 约 4.4 分、数百万评价、十亿级下载 | 点击、说话后立即出现清晰表情和动作 | 保留即时反馈，避免广告、重复刷取和强制养成 |
| [TinyRoommate](https://github.com/ryannli/tiny-roommate) | 新兴开源 AI 桌宠 | 克制的主动陪伴、可读的长期记忆、知道何时安静 | 闲置动作限时触发，长时间无操作后自然休息 |
| [CoPet](https://github.com/ChanceYu/CoPet) | 活跃开源桌宠 | 状态驱动动作、丰富点击/长按/拖动反馈、尺寸设置 | 使用统一动作状态机，并保留后续扩展触摸语义的空间 |
| [Desktop Pet](https://github.com/chron303/desktop-pet) | MIT 开源 Windows 项目 | 连续二维情绪、行为状态机、成就墙、昼夜感知和贴身 HUD | 重写为跨平台纯状态模块；不复制其 Python 外壳、角色素材或产品文案 |

## 落地原则

1. 电脑端坚持桌宠：小诺、云团、月狸及用户导入角色继续使用透明悬浮、动作和养成系统。
2. 移动端坚持工具：以对话、文件、语音、手机工具和模型中心为主，不复制桌面宠物容器。
3. 模型自由：支持 OpenAI 兼容 API、局域网无密钥端点，以及 Android 应用内选择和下载 GGUF 模型。
4. 行为可控：跨 App 操作必须先展示动作并由用户确认，敏感界面自动终止。
5. 不复制角色：影视与动画只能作为抽象风格灵感，默认小诺保持原创外形与动作。
