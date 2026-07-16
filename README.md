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

## 在线分享

上传到 GitHub 后，可在仓库 Settings → Pages 中选择从 `main` 分支根目录发布。
发布后分享这个地址给同学：

```text
https://mayinsitan1.github.io/Species_identification/frog-study-app/
```

网页顶部的“分享”按钮会调用手机系统分享面板；不支持系统分享时会复制当前链接。

## 离线使用

这个网页是 PWA。手机第一次联网打开后，会自动缓存应用核心文件和缩略图。

- 已缓存后，即使临时没网，也能打开图鉴、分类、文字信息和缩略图。
- 原图和鸣声体积较大，会在同学在线查看或播放后按需缓存。
- 如果需要完全离线带走全部原图和鸣声，建议把整个项目文件夹压缩成离线包，通过 U 盘、AirDrop、网盘或班级群发送；解压后打开 `frog-study-app/index.html` 即可浏览。

## 数据来源

资料来自 NSII 中国国家标本资源平台“无尾两栖类鸣声专题”：

https://www.nsii.org.cn/2017/AnuraVoice.php

请遵守来源网站和原作者对图片、录音的版权与引用要求。
