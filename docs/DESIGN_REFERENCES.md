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

## 落地原则

1. 同一只宠物：电脑与移动端使用相同小诺图集、210×228 显示比例和动作语义。
2. 同一套入口：两端都有摸摸、挥手、说话，回答期间使用同一思考与说话动作。
3. 平台只改变容器：电脑默认透明悬浮，手机默认全屏触控；展开后的信息层级保持一致。
4. 即时反馈：每次触摸、语音和回答都必须立即改变动作、状态文字或气泡。
5. 克制陪伴：宠物会主动活动，但不会持续弹窗；闲置一段时间后进入睡眠。
6. 模型自由：继续支持 OpenAI 兼容 API、本地无密钥端点和自由模型名称。
7. 不复制角色：影视与动画只能作为抽象风格灵感，默认小诺保持原创外形与动作。
