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

> 并且这份白名单中还限制版本，所以去对应的 repo 看文档和源码还要切换到对应版本才行，例如 [minima v2.5.1](https://github.com/jekyll/minima/tree/v2.5.1)

用它支持的 [jekyll-paginate@1.1.0](https://github.com/jekyll/jekyll-paginate/tree/v1.1.0) 则非常不方便，没办法自定义后缀和首页，只好加个跳转，勉强能用了。

### cache

搞不懂这些浏览器缓存，干脆把什么 `Cache-Control: no-cache` 和 `Math.random()` 都加上，自用不是很在意这些性能。

### Node

`actions/github-script@v5` 只支持 node 12，刚好这几天更新了 v6，将 node 版本改为 node 16，但还是不够灵活，如果要把逻辑放到 [a separate file](https://github.com/actions/github-script#run-a-separate-file) ，就需要打包成 CommonJS。

但是依赖里又有 Pure ESM，作为 NodeJS 新手，乱七八糟的实在是搞不定，切换成 ESM，原本配置好的 rollup 又挂了，同时 jest 还挂掉了，按照 jest 支持 ESM 的文档说明也配置不好。

于是我干脆仿照的 `actions/github-script` 的源码，自己实现了 [直接运行 ts](./.github/workflows/convert.yml#L39-L60)


## inline commands
> 设计了一些 inline commands，选用了 markdown 里的三层 quote 作为标识，而不是容易影响 markdown 格式的 jekyll 的 YAML front matter。刚好 github-actions 这个 app对 issues 进行的操作是不会触发 Github Actions 的，可以用于编译修改包含 inline commands 的 issue/comment。
- [x] `author` 对应 jekyll YAML front matter 的 author
  ```
  >>> author [AUTHOR]

      >>> author "Bill Bill"
  ```
- [x] `desc/description` 对应 jekyll YAML front matter 的 description
  ```
  >>> desc [line1]
           [line2]
           [line3]

      >>> desc `hello dword` `hi`
              line2
              "line 3"
  ```
- [x] `img/image` 远程请求并插入图片，会利用 [file-type](https://github.com/sindresorhus/file-type) 来尝试识别图片格式
  ```
  >>> img [LINK]

      >>> img https://github.githubassets.com/images/modules/logos_page/Octocat.png
  ```
- [x] `jump` 从首页点击时不跳转到 jekyll post 链接，而是指定的链接
  ```
  >>> jump [LINK]

      >>> jump https://github.com/actions
  ```
- [x] `del/delete` 删除对应的 post，防止删除 issue/comment 触发的 github actions 失败了无法再触发，archive 的只删除展示页，具体的 archive 文件不会删除
  ```
  >>> del [LINK]

      >>> del https://hellodword.github.io/issue-notes/2022/02/03/1-1029028094.html
      >>> del https://github.com/hellodword/issue-notes/issues/1#issuecomment-1029028094
      >>> del /1-1029028094.html
      >>> del /1#issuecomment-1029028094
  ```
- [x] `code` 远程请求并嵌入代码，不指定 lang 的时候会利用 [vscode-languagedetection](https://github.com/microsoft/vscode-languagedetection) 自动识别来进行高亮
  ```
  >>> code [OPTIONS] [LINK]
      Options:
            --lang   Identifier to enable syntax highlighting
            --name   <name> File name

      >>> code https://github.com/microsoft/vscode-languagedetection/blob/4a85ba3b62ddc60d7dfb27d8b1c3855aea49a861/package.json
  ```
- [x] `archive` 可以对文章进行 archive，利用一些 web archiving 工具
  > [Awesome Web Archiving](https://github.com/iipc/awesome-web-archiving)
  ```
  >>> archive [LINK]
      Options:
            --title  <title>  标题
            --author <author> 作者
            --date   <date>   日期
            --engine <engine> web archiving 引擎，可选 archivebox,cairn,obelisk，默认 all

      >>> archive --title "How NAT traversal works" --author "David Anderson" https://tailscale.com/blog/how-nat-traversal-works/
  ```

## Events
- `issue_comment`:
  - [x] created
  - [x] edited
  - [x] deleted
  - [x] `hide/unhide`  
    github 只提供了操作 minimize 的 api，但所有 api result 中均没有关于是否隐藏的信息，但是又会触发 edited，只好通过请求网页来判断。（我觉得是产品缺陷，要么不该触发 edited，要么就应该在 event 中提供明确信息，已经向官方反馈并被告知 `We'd need the GitHub API to learn about this and emit an event so that we can do that as well. I'll put this on that team's backlog.` ）
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

- [x] archive 同时使用多个引擎，并且展示在首页的同一条
- [ ] 解析 title/description/author/date，最终实现一条链接自动完事
- [ ] 储存 code link 对应的文件，以规避 IssueComment 的 65536 characters 上限
- [x] ts
- [ ] 优化代码，补齐测试
