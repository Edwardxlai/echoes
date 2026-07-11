# 解析 + ASR 管线测评

只验证一条管道：**粘链接 → 解析无水印直链 → 下载 → ffmpeg 抽音频 → 火山豆包 ASR → 吐出视频文字**。
不落库、不做转写编辑，跑完页面逐步显示每一步通没通、断在哪。

## 跑起来

```bash
cp eval/.env.example eval/.env   # 填好 key（见下）
node eval/server.mjs             # 打开 http://localhost:6060
```

Node 20+ 即可，零 npm 依赖。

## 需要哪三样（缺哪样对应步骤会红）

| 依赖 | 干嘛 | 缺了会 |
|------|------|--------|
| **ffmpeg** | 从视频抽 16k 单声道 mp3 | 「抽音频」步骤红 |
| **parse-video sidecar** | 抖音链接 → 无水印直链 | 「解析直链」步骤红（测直链不需要） |
| **火山豆包 ASR key** | 音频 → 文字 | 「ASR 转写」步骤红 |

> 只想先单测「下载+ffmpeg+ASR」、跳过抖音 sidecar：页面点「一个测试直链」即可。

## 各样在哪取

**① 火山豆包 ASR（必填）**
- 火山引擎控制台 → 语音技术 → **录音文件识别·极速版**（`volc.bigasr.auc_turbo`）
- 开通后拿 **API Key** 填 `VOLC_ASR_API_KEY`（新版控制台就一个 key）；旧版是 App Key + Access Key 两个。
- 官网：https://console.volcengine.com/speech/

**② parse-video sidecar（抖音必需）**
- 开源项目 wujunwei928/parse-video，Docker 一条命令起：
  ```bash
  docker run -d --name parse-video -p 8080:8080 wujunwei928/parse-video
  ```
- 起好后 `PARSE_VIDEO_API_URL=http://localhost:8080`。`npm run dev` 会自动检测并拉起。
- 仓库：https://github.com/wujunwei928/parse-video

**③ ffmpeg**
- Windows：https://www.gyan.dev/ffmpeg/builds/ 下载，解压后把 `bin\ffmpeg.exe` 路径填 `FFMPEG_PATH`（或加进 PATH 后留 `ffmpeg`）。

## 页面怎么看

- 顶部一行显示当前 ffmpeg / parse-video / 火山是否已配置。
- 粘链接 → 「跑一遍」→ 六步 stepper 实时出结果，绿✓ / 红✕。
- 全通 → 底部绿条 + 下方显示 ASR 转出的完整文字。
- 断了 → 红条告诉你断在哪一步、什么原因。
