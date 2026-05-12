论文章节盘点
═══════════════════════════════════════════════════════

§ Abstract
  内容摘要：π0.7 是 steerable generalist robotic foundation model，可通过 diverse context conditioning 在多机器人、多任务、复杂指令、跨 embodiment 和组合泛化中取得强 out-of-the-box 表现。
  → 报告位置：§1 论文速览

§ 1. Introduction
  内容摘要：机器人 foundation model 的组合泛化仍困难；π0.7 通过 richer prompt/context 让模型不仅知道做什么，还知道如何做，并可利用多质量、多来源数据。
  涉及图表：Figure teaser。
  → 报告位置：§2 动机 / §1 速览

§ 2. Related Work
  内容摘要：讨论 VLA、memory/hierarchy、video/world model、cross-embodiment、generalist robotics 等方向。
  → 报告位置：§3 相关工作梳理

§ 3. Flow-Based Vision-Language-Action Models
  内容摘要：定义 VLA observation/action/context/action chunk，给出 imitation learning objective；介绍 action expert、flow matching、FAST tokens、knowledge insulation。
  涉及公式：Eq. vla_il。
  → 报告位置：§4.3

§ 4. π0.7 Overview
  内容摘要：5B 参数 VLA；4B Gemma3 VLM backbone、MEM-style history encoder、860M action expert；context 包括 language、metadata、subgoal images。
  涉及图表：Architecture overview。
  → 报告位置：§4.1 / §4.4

§ 5. The π0.7 Model and Training Recipe
  §5.1 Diversifying the Prompt / Subtask instructions
    内容摘要：扩展 language command，引入 next semantic subtask，支持 runtime verbal coaching。
    → 报告位置：§4.3
  §5.2 Subgoal images
    内容摘要：用 image-generation world model 产生未来目标图像，把非机器人/网页视频概念迁移到 VLA prompt。
    → 报告位置：§4.3 / §4.4
  §5.3 Episode metadata
    内容摘要：通过 metadata 区分数据质量、策略、成功/失败，使模型可利用 failures、suboptimal autonomous data 和 specialist rollouts。
    → 报告位置：§4.3
  §5.4 Full prompt/training details, datasets, architecture, subgoal training
    内容摘要：component dropout、diverse datasets、Gemma3/MEM/action expert、BAGEL-based world model 等实现细节。
    → 报告位置：§4.4 / §5.1

§ 6. Robot system details
  内容摘要：多机器人平台与控制细节。
  → 报告位置：§5.1

§ 7. Experimental Evaluation
  §7.1 Out-of-the-box performance
    内容摘要：espresso、box building、laundry、peanut butter sandwich、shirt inside-out、door、zucchini、peeling、trash 等任务，与 RL/SFT specialists 对比；metadata/eval data 消融。
    → 报告位置：§5.2 / §5.3
  §7.2 Instruction following
    内容摘要：复杂指令、referential instructions、reverse tasks、memory tasks；GC 对 Reverse Fridge to Microwave 关键。
    → 报告位置：§5.2 / §6
  §7.3 Cross-embodiment transfer
    内容摘要：不同机器人之间迁移，UR5e shirt folding 与 expert teleoperators 接近；补充比较 joint vs EE control。
    → 报告位置：§5.2 / §5.4
  §7.4 Compositional task generalization
    内容摘要：新厨房电器、air fryer、coaching、短/长 horizon 新任务。
    → 报告位置：§5.2 / §6

§ 8. Discussion
  内容摘要：seen tasks 常 >90%，zero-shot/unseen 为 60-80%；难以严格判定 unseen；未来方向包括 coaching 和 autonomous RL。
  → 报告位置：§6

§ Supplementary section
  § Contributions / Attention pattern / Training of world model / Inference speed / action spaces / human study / task rubric
    内容摘要：补充模型贡献、attention mask、world model 训练、推理优化、跨 embodiment action space、人类对照、详细任务评分。
    → 报告位置：§4.4 / §5.1 / §5.4 / §6

未覆盖内容检查：
  [x] 所有正文节和补充节均有报告位置。
  [x] Introduction 的组合泛化动机进入 §2。
  [x] 方法训练公式和 prompt 组成进入 §4。
  [x] 补充的 world model、inference speed、human study、scoring rubric 已整合。
  [x] 图表均已转为 PNG 并在报告中选择性嵌入关键图。
