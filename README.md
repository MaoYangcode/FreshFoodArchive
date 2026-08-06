# 鲜食档案 FreshFoodArchive

一款面向家庭冰箱管理场景的微信小程序。项目以“记录库存、减少浪费、快速做饭”为核心，支持食材入库与出库、临期提醒、AI 图片/小票识别、异步菜谱生成、营养分析和智能语音助手。

## 功能特性

### 冰箱库存管理

- 食材新增、编辑、删除和分批出库
- 冷藏/冷冻位置与食材类别筛选
- 数量、单位、购买日期和过期日期管理
- 新鲜、临期、过期状态提示
- 食材类别占比统计
- 出库记录与自定义保质期规则

### AI 智能录入

- 拍照识别食材名称、类别和数量
- 购物小票识别与批量入库
- 识别结果确认、修改和选择性入库
- 图片压缩、上传限制与异常提示

### 智能语音助手

- 语音入库：如“买了 3 个番茄放冷藏”
- 语音出库：如“今天用了 2 个鸡蛋”
- 查询库存与指定食材余量
- 查询临期、过期食材
- 根据库存或指定食材推荐菜谱
- 朗读库存查询结果与菜谱内容
- 涉及库存变更时先展示解析结果，确认后再执行

### AI 菜谱推荐

- 根据冰箱现有食材生成菜谱
- 使用异步任务与前端轮询，避免长时间阻塞页面
- 首次快速返回菜名、所需食材、用时和难度
- 用户进入详情后再按需生成步骤与营养分析并缓存
- 支持按匹配度、用时和难度排序
- 展示冰箱已有食材与仍需准备的食材
- 菜谱收藏、完成标记和缺少食材加入菜篮子

### 其他功能

- 微信静默登录与用户数据隔离
- 临期提醒设置与提醒记录
- 菜篮子管理及已购食材一键入库
- 用户资料、饮食偏好和忌口信息
- 本地缓存与网络异常降级展示

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 小程序前端 | uni-app、Vue 3、微信小程序 |
| 服务端 | NestJS 11、TypeScript |
| 数据访问 | Prisma 7、MariaDB Adapter |
| 数据库 | MySQL / MariaDB |
| AI 能力 | 阿里云百炼 DashScope（视觉、文本、ASR、TTS） |
| 身份认证 | 微信 `jscode2session`、Bearer Token |
| 生产部署 | Nginx、PM2、HTTPS |

## 系统流程

```mermaid
flowchart LR
    A[微信小程序] -->|HTTPS API| B[NestJS 服务]
    B --> C[(MySQL / MariaDB)]
    B --> K[(Neo4j 菜谱知识图谱)]
    K --> V[向量与图关系检索]
    B --> D[微信登录服务]
    B --> E[DashScope AI]
    E --> E1[食材与小票识别]
    E --> E2[语音识别与指令解析]
    E --> E3[菜谱与营养分析]
    E --> E4[语音合成]
```

菜谱推荐采用异步任务模式：前端创建任务后进入结果页并轮询状态。后端优先从 Neo4j 向量/图关系或本地 JSON 知识库返回已有菜谱和完整步骤；知识库不足时才调用大模型补充，从而降低等待时间并减少菜谱事实漂移。

## 项目结构

```text
FreshFoodArchive/
├── api/                    # 小程序 API 请求与接口模块
├── components/             # 公共组件、底部导航、图标组件
├── pages/
│   ├── assistant/          # 智能语音助手
│   ├── fridge/             # 冰箱列表、添加、编辑、保质期设置
│   ├── home/               # 首页与优先提醒
│   ├── profile/            # 个人中心、收藏、菜篮子、提醒记录
│   └── recipe/             # 菜谱生成、结果列表与详情
├── static/                 # 字体、图标和助手形象资源
├── utils/                  # 用户状态、音频播放等工具
├── manifest.json           # uni-app / 微信小程序配置
├── pages.json              # 页面路由配置
└── server/
    ├── prisma/             # Prisma 数据模型
    ├── src/                # NestJS 业务模块
    ├── .env.example        # 服务端环境变量示例
    └── package.json
```

## 本地运行

### 环境要求

- HBuilderX
- 微信开发者工具
- Node.js 20 或更高版本
- MySQL 8 / MariaDB
- 可选：阿里云百炼 DashScope API Key

### 1. 克隆项目

```bash
git clone https://gitee.com/MaoYangcode/FreshFoodArchive.git
cd FreshFoodArchive
git checkout release/new-cloud-setup
```

也可以使用 GitHub：

```bash
git clone https://github.com/MaoYangcode/FreshFoodArchive.git
```

### 2. 配置并启动服务端

```bash
cd server
npm install
cp .env.example .env
```

修改 `server/.env`：

```dotenv
PORT=3000

DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=your_password
DATABASE_NAME=fresh_food_archive
DATABASE_URL="mysql://root:your_password@127.0.0.1:3306/fresh_food_archive"

DASHSCOPE_API_KEY=your_dashscope_api_key
DASHSCOPE_VISION_MODEL=qwen3.6-flash
DASHSCOPE_TEXT_MODEL=qwen2.5-14b-instruct
DASHSCOPE_EMBEDDING_MODEL=text-embedding-v4
DASHSCOPE_EMBEDDING_DIMENSIONS=1024
DASHSCOPE_ASR_MODEL=qwen3-asr-flash

NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password
NEO4J_DATABASE=neo4j

WECHAT_MINI_APP_ID=your_wechat_app_id
WECHAT_MINI_APP_SECRET=your_wechat_app_secret
AUTH_TOKEN_SECRET=replace_with_a_long_random_string
```

初始化数据库并启动开发服务：

```bash
npx prisma generate
npx prisma db push
npm run start:dev
```

服务默认运行在 `http://localhost:3000`，访问根路径可检查服务是否启动。

> 请勿提交真实的 `.env`、数据库密码、微信 AppSecret 或 DashScope API Key。

### 3. 配置小程序

1. 使用 HBuilderX 导入项目根目录。
2. 在 `manifest.json` 中填写自己的微信小程序 AppID。
3. 将 `api/request.js` 中的默认服务地址改为自己的 HTTPS API 域名。
4. 在 HBuilderX 中选择“运行到小程序模拟器 → 微信开发者工具”。
5. 首次运行时确认微信开发者工具已开启对应项目并完成编译。

开发环境可以关闭域名校验；发布体验版或正式版前，需要在微信公众平台配置合法的 request、uploadFile 和 downloadFile 域名。

## 服务端环境变量

| 变量 | 说明 | 是否必需 |
| --- | --- | --- |
| `PORT` | 服务监听端口，默认 `3000` | 否 |
| `DATABASE_HOST` | 数据库地址 | 是 |
| `DATABASE_PORT` | 数据库端口 | 是 |
| `DATABASE_USER` | 数据库用户 | 是 |
| `DATABASE_PASSWORD` | 数据库密码 | 是 |
| `DATABASE_NAME` | 数据库名称 | 是 |
| `DATABASE_URL` | Prisma CLI 使用的数据库连接串 | 是 |
| `DASHSCOPE_API_KEY` | 阿里云百炼 API Key | AI 功能必需 |
| `DASHSCOPE_VISION_MODEL` | 图片与小票识别模型 | 否 |
| `DASHSCOPE_TEXT_MODEL` | 菜谱和指令解析模型 | 否 |
| `DASHSCOPE_ASR_MODEL` | 语音识别模型 | 否 |
| `AI_TTS_MODEL` | 语音合成模型，默认 `qwen3-tts-flash` | 否 |
| `AI_TTS_VOICE` | 朗读音色，默认 `Cherry` | 否 |
| `WECHAT_MINI_APP_ID` | 微信小程序 AppID | 是 |
| `WECHAT_MINI_APP_SECRET` | 微信小程序 AppSecret | 是 |
| `AUTH_TOKEN_SECRET` | 登录令牌签名密钥 | 是 |
| `AI_RECOGNIZE_FALLBACK_TO_MOCK` | AI 识别异常时是否启用模拟结果 | 否 |
| `DASHSCOPE_EMBEDDING_MODEL` | 菜谱向量模型，默认 `text-embedding-v4` | 否 |
| `DASHSCOPE_EMBEDDING_DIMENSIONS` | 向量维度，默认 `1024` | 否 |
| `NEO4J_URI` | Neo4j Bolt 地址；不配置时自动使用本地 JSON 检索 | 否 |
| `NEO4J_USER` | Neo4j 用户名 | 否 |
| `NEO4J_PASSWORD` | Neo4j 密码 | 否 |
| `NEO4J_DATABASE` | Neo4j 数据库名，默认 `neo4j` | 否 |

## 常用命令

在 `server` 目录执行：

```bash
npm run start:dev    # 开发模式
npm run build        # 构建服务端
npm run start:prod   # 运行生产构建
npm run test         # 单元测试
npm run validate:recipes        # 校验全部结构化菜谱
npm run sync:recipe-knowledge   # 同步图谱并生成向量
npm run test:e2e     # 端到端测试
npm run lint         # 代码检查并修复
```

## 生产环境更新

示例部署目录为 `/opt/FreshFoodArchive`，服务器从 Gitee 发布分支拉取：

```bash
cd /opt/FreshFoodArchive
git pull --ff-only gitee release/new-cloud-setup

cd server
npm install
npx prisma generate
npm run build
sudo pm2 restart all --update-env
sudo pm2 status
```

如果 Prisma 数据模型发生变化，请在备份数据库后执行相应迁移；不要在重要生产数据库上未经确认直接重建数据表。

小程序前端更新不依赖服务器自动发布，需要在 HBuilderX 重新编译，并在微信开发者工具中上传新的体验版或正式版。

## 安全与发布注意事项

- 生产环境必须使用 HTTPS。
- 不要将 `.env`、Token、数据库密码或第三方 API Key 提交到仓库。
- Nginx 上传大小应覆盖图片识别请求，服务端当前允许最大 8MB 图片和 12MB 音频。
- 修改字体或图标时应继续使用精简字体，避免超过微信小程序包体限制。
- `unpackage/` 是编译产物，提交代码时应优先提交 `pages/`、`components/`、`api/`、`utils/` 和 `server/src/` 等源文件。
- 上传体验版前建议清理微信开发者工具缓存并重新编译，避免使用旧代码。

## 当前状态

项目目前处于持续开发阶段，主要功能已完成并可用于微信小程序体验测试。生产使用前建议补充自动化测试、数据库迁移方案、日志监控和隐私政策。

## License

当前仓库未声明开源许可证，未经许可请勿用于商业分发。
