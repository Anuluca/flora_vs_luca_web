# 花花 VS 路卡

基于 React、TypeScript 与 vinext 的本地网页游戏。

## 本地开发

```bash
npm install
npm run dev
```

默认访问开发服务器输出的 Local URL。当前项目不包含自动发布流程。

## 质量检查

```bash
npm run typecheck
npm run lint
npm test
# 或一次执行全部检查
npm run check
npm run seo:audit
```

`typecheck` 检查配置与组件的数据边界；`npm test` 会执行生产构建、服务端渲染检查和游戏配置边界检查；`seo:audit` 验证静态发布目录中的标题、摘要、canonical、sitemap、robots、Manifest 与图标。

## 项目结构

```text
app/
  HuaVsLucaGame.tsx                 # 页面编排、交互事件与游戏循环
  globals.css                       # 当前视觉系统与响应式样式
features/game/
  components/GameBrand.tsx          # Logo、返回按钮、对战预览、固定装饰
  config/
    cats.ts                         # 猫咪数据
    enemies.ts                      # 敌人数据
    levels.ts                       # 关卡数据
    assets.ts                       # 公共素材地址与自动生成的预加载清单
    index.ts                        # 配置层统一出口
  domain/
    config-types.ts                 # 配置数据结构
    model.ts                        # 游戏规则、局内状态和纯逻辑函数
  infrastructure/
    progress-storage.ts             # LocalStorage 读写与旧数据迁移
tests/
  rendered-html.test.mjs            # 构建、渲染和配置结构测试
```

## 数据维护入口

### 猫咪

编辑 `features/game/config/cats.ts`。

- `imageAssets`：图鉴和阵容卡片使用的全部图片。
- `projectileAssets`：游戏中随机使用的弹射图片。
- `previewAssets`：选关卡片中的图片及排列顺序。
- `position`：图鉴中的站位标签。

新增猫咪后，在目标关卡的 `catTypeIds` 中引用它的配置键。

### 敌人

编辑 `features/game/config/enemies.ts`。

- `imageAssets`：图鉴和阵容卡片图片。
- `headAsset`：游戏内角色头部图片。
- `strength`：图鉴强度，范围为 1–5。
- `bodyColor`、`armColor`：游戏内外观。
- `speed`：该敌人类型每秒沿跑道前进的百分比距离。
- `killScore`：击败该敌人的基础得分。

线上素材按类型归档到 R2：猫咪放在 `cats/<类型 ID>/`，敌人放在
`enemies/<类型 ID>/`，统一由 `https://assets.anuluca.com/otherWebsites/flora-vs-luca/`
提供。文件名使用用途而非序号来源，例如 `projectile-01.webp`、`head.webp`；新增类型时
创建独立文件夹，并在对应类型配置中登记，加载页会自动汇总该配置内的全部素材。

同一猫咪类型的素材统一使用 `900 × 900` 透明画布，主体保持原始比例居中；网页运行时
优先引用高质量 WebP，PNG/JPG 仅保留为原始素材备份。

新增敌人后，在目标关卡的 `enemyTypeIds` 中引用它的配置键。

### 关卡

编辑 `features/game/config/levels.ts`。

- `difficulty`：显示难度，范围为 1–5。
- `totalEnemies`：普通关卡敌人总量。
- `catTypeIds`：本关允许使用的猫咪类型。
- `enemyTypeIds`：本关会出现的敌人类型。
- `redHeatRanges`：可选的红温进度区间，使用 0～1 比例；命中区间时敌人按类型基础速度的三倍移动。

猫咪和敌人 ID 由 TypeScript 自动推导；关卡引用不存在的 ID 时，构建会直接失败。

## 本地进度

完成状态与各关最高分由 `features/game/infrastructure/progress-storage.ts` 管理，存储键为：

```text
hua-vs-luca-level-progress-v2
```

当前进度只保存在浏览器 LocalStorage。若后续商业化需要跨设备同步，应在基础设施层增加服务端存储适配，不要在页面组件中直接加入数据库请求。
