# Species Identification

无尾两栖类学习与辅助识别网页应用。

## 内容

- `frog-study-app/`：手机端网页应用，可搜索、筛选、查看图片/鸣声、随机小测。
- `NSII_无尾两栖类鸣声专题/`：从 NSII 无尾两栖类鸣声专题整理的物种、图片和鸣声资料。
- `download_nsii_anura.py`：重新下载和整理 NSII 数据的脚本。

## 本地运行

在项目根目录启动静态服务：

```bash
python3 -m http.server 8765 --bind 0.0.0.0
```

然后打开：

```text
http://127.0.0.1:8765/frog-study-app/
```

手机需要与电脑连接同一 Wi-Fi，再使用电脑的局域网 IP 访问。

## 数据来源

资料来自 NSII 中国国家标本资源平台“无尾两栖类鸣声专题”：

https://www.nsii.org.cn/2017/AnuraVoice.php

请遵守来源网站和原作者对图片、录音的版权与引用要求。
