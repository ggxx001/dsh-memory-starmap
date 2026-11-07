# 记忆星图 · dsh-memory-starmap

把长期记忆画成一颗星：七层记忆各占一层球壳，层内的点按真实关联（共享关键词）聚团。点一个就只看它，其余压暗；45 天没被取用的点会变灰。

这是给 [DSH](https://github.com/deepseek-ai) 用的插件，配合本机的「记忆台」服务读数据。

## 它长什么样

- 左下角一颗小球，轻点展开全屏面板，可拖动挪位
- 七层球壳（soul / user / project / fact / lesson / topic / rules），层内做力导向：吸引 0.035、互斥 0.0016，迭代 22 轮
- 实心金点 + 淡光晕，关联线金色高亮；45 天未取用变灰
- 球体本身不上色——颜色只留给「人看得懂的信息」

## 数据从哪来

插件只读本机 `http://127.0.0.1:8801/api/all`（记忆台），返回结构：

```json
{
  "nodes": [ { "id": "...", "level": "fact", "title": "...", "keywords": ["..."], "importance": 2, "status": "active", "accessedAt": 0 } ],
  "levels": [ "soul", "user", "project", "fact", "lesson", "topic", "rules" ]
}
```

没有记忆台也能跑：把 `client.js` 顶部的 `API` 换成任何返回上面结构的地址即可（例如一个静态 json）。

## 安装

1. 把本仓库放到 `D:\deepseek\plugins\dsh-memory-starmap`（或任意目录）
2. 在 `~/.dsh/profiles/desktop/package.json` 里：
   - `dependencies` 加 `"dsh-memory-starmap": "link:D:/deepseek/plugins/dsh-memory-starmap"`
   - `dsh.profile.bundles` 加 `"dsh-memory-starmap"`
3. 重启 DSH，设置里出现「记忆星图」

## 许可

MIT。随便用、随便改，不用问我。
