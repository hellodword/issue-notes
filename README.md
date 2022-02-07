# issue notes

## 原因

有点类似于 [issue-to-jekyll-post](https://github.com/yoshum/issue-to-jekyll-post) 这个项目，通过 `issues` 和 `issue_comment` 这两个 event 触发 Github Actions，将对应的 issue 编译成 jekyll 的 `_posts/*.md`，接下来就交给 Github Pages 了 。

Github Issues 支持：
- 全平台
- 搜索
- markdown 编辑器
- 图片（博客域名如果是 `user.github.io` 则可以当作图床使用）
- 文件
- Label（可以对应 Tag）
- Pin（可以对应置顶？）

又是对话的方式，我觉得很适合用作记录一些碎片。

由于是借助 git，还可以通过 commits 查看历史。

就算未来 Github Actions 不服务了，数据起码还在 Github，我觉得比我自己保管要安全一点。

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


## inline commands
> 设计了一些 inline commands，选用了 markdown 里的三层 quote 作为标识，而不是容易影响 markdown 格式的 jekyll 的 YAML front matter。刚好 github-actions 这个 app对 issues 进行的操作是不会触发 Github Actions 的，可以用于编译修改包含 inline commands 的 issue/comment。
- [x] `author` 对应 jekyll YAML front matter 的 author
  ```
  >>> author [AUTHOR]
  ```
- [x] `desc` 对应 jekyll YAML front matter 的 description
  ```
  >>> desc [line1]
           [line2]
           [line3]
      >>> desc `hello dword` `hi`
              line2
              "line 3"
  ```
- [x] `img` 远程请求并插入图片
  ```
  >>> img [LINK]
  ```
- [x] `jump` 首页不跳转到 jekyll post 链接
  ```
  >>> jump [LINK]
  ```
- [x] `del` 删除对应的 post，防止删除 issue/comment 触发的 github actions 失败了无法再触发，archive 的就不支持了，手动删除吧
  ```
  >>> del [LINK]
      >>> del https://hellodword.github.io/issue-notes/2022/02/03/1-1029028094.html
      >>> del https://github.com/hellodword/issue-notes/issues/1#issuecomment-1029028094
      >>> del /1-1029028094.html
      >>> del /1#issuecomment-1029028094
  ```
- [x] `code` 远程请求并嵌入代码
  ```
  >>> code [OPTIONS] [LINK]
      Options:
            --lang   Identifier to enable syntax highlighting
            --name   <name> File name
      >>> code https://test.com/test.js
  ```
- [x] `archive` 可以对文章进行 archive，利用一些 web archiving 工具
  > [https://github.com/iipc/awesome-web-archiving](https://github.com/iipc/awesome-web-archiving)
  ```
  >>> archive [LINK]
      Options:
            --title  <title>  标题
            --author <author> 作者
            --date   <date>   日期
            --engine <engine> web archiving 引擎，可选 archivebox,cairn,obelisk,rivet
      >>> archive --title "How NAT traversal works" --author "David Anderson" https://tailscale.com/blog/how-nat-traversal-works/
  ```

## Events
- `issue_comment`:
  - [x] created
  - [x] edited
  - [x] deleted
  - [x] `hide/unhide` github 只提供了操作 minimize 的 api，但所有 api result 中没有关于是否隐藏的信息，但是会触发 edited，只好通过请求网页来判断
- `issues`:
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

## TODO

- [ ] archive 同时使用多个引擎，并且展示在首页的同一条
- [ ] 解析 title/description/author/date，最终实现一条链接自动完事
- [ ] 储存 code link 对应的文件，以规避 IssueComment 的 65536 characters 上限
- [ ] 确保 _posts 中的文件进行了 url encode，从而不会被误识别 liquid
