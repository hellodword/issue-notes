# issue notes

## 原因

Github Ussues 支持：
- 搜索
- markdown
- 图片
- 文件
- Label
- Pin

又是对话的方式，很适合用作记录一些碎片。

这个项目的出发点类似于 [issue-to-jekyll-post](https://github.com/yoshum/issue-to-jekyll-post)，将 issues 的内容通过 jekyll 展示。

## 过程

### infinite scroll

照抄了 [vue-infinite-loading - 从 Hacker News 开始](https://github.com/PeachScript/vue-infinite-loading/blob/4baed2bb078f076d3bff48c783ed324236630ed6/docs/zh/guide/start-with-hn.md)，用以实现 infinite scroll。

于是就需要为 jekyll 添加 pagination 来支持 feed。

### pagination

最初选用 [jekyll-paginate-v2](https://github.com/sverrirs/jekyll-paginate-v2)，非常方便，可以指定路径和后缀。

结果 [Github Pages 并不支持](https://pages.github.com/versions/)。

用它支持的 [jekyll-paginate@1.1.0](https://github.com/jekyll/jekyll-paginate/tree/v1.1.0) 则非常不方便，没办法自定义后缀和首页，只好加个跳转，勉强能用了。

### cache

搞不懂这些浏览器缓存，干脆把什么 `Cache-Control: no-cache` 和 `Math.random()` 都加上，自用不是很在意这些性能。


## TODO

  - [ ] description
  - [ ] commands
    - [ ] force delete
  - [x] event `issue_comment`:
    - [x] created
    - [x] edited
    - [x] deleted
  - [ ] event `issues`:
    - [x] opened
    - [x] edited
    - [x] deleted
    - [ ] transferred
    - [ ] pinned
    - [ ] unpinned
    - [ ] closed
    - [x] reopened
    - [ ] assigned
    - [ ] unassigned
    - [ ] labeled
    - [ ] unlabeled
    - [ ] locked
    - [ ] unlocked
    - [ ] milestoned
    - [ ] demilestoned

