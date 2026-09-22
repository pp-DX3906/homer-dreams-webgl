# Homer Dreams — WebGL Study

一个 WebGL 动画场景：蓝紫与粉橘渐变的甜甜圈隧道、星空与云层，以及漂浮的漫画风床和枕头。两侧会陆续出现少量薄荷、浅蓝与粉橘色的特别甜甜圈。

[在线预览](https://pp-dx3906.github.io/homer-dreams-webgl/)

## 本地预览

在项目目录运行：

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

然后打开 <http://127.0.0.1:4173/>。需要支持 WebGL 2 的浏览器。

## 交互

- 按住并拖动画面：调整视角
- 鼠标滚轮：拉近或拉远
- 点击变色的甜甜圈：加速 1×，最高 10×；点击其他位置不加速
- 空格键或左下角按钮：暂停或继续

床模型位于 `assets/bed_comic.glb`；Three.js 模块与加载器已保存在 `vendor/` 和 `utils/`，预览不依赖在线 CDN。
