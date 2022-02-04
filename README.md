# issue notes

## 原因

有点类似于 [issue-to-jekyll-post](https://github.com/yoshum/issue-to-jekyll-post) 这个项目，通过 `issues` 和 `issue_comment` 这两个 event 触发 Github Actions，将对应的 issue 编译成 jekyll 的 `_posts/*.md`，接下来就交给 Github Pages 了 。

Github Ussues 支持：
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


## TODO

  - [ ] inline commands
    > 设计了一些 inline commands，选用了 markdown 里的三层 quote 作为标识，而不是容易影响 markdown 格式的 jekyll 的 YAML front matter。刚好 github-actions 这个 app 对 issues 进行的操作是不会触发 Github Actions 的，可以用于编译修改包含 inline commands 的 issue/comment。
    - [ ] author
      ```
      Usage:  >>> author [AUTHOR]
      ```
      ```md
      >>> author "hello dword"
      ```
    - [ ] description/desc
      ```
      Usage:  >>> description [line1]
              >>> description [line2]
              >>> description [line3]
      ```
      ```md
      >>> description "hello dword"
      >>> desc line 2
      >>> description line 3
      ```
    - [ ] image/img
      ```
      Usage:  >>> img [LINK]
      ```
      ```md
      >>> img https://test.com/test.png

      ![https://test.com/test.png](https://user-images.githubusercontent.com/1234567/12345678.png)
      ```
    - [ ] file
      ```
      Usage:  >>> file [OPTIONS] [LINK]

        Only support .gif,.jpeg,.jpg,.mov,.mp4,.png,.svg,.csv,.docx,.fodg,.fodp,.fods,.fodt,.gz,.log,.md,.odf,.odg,.odp,.ods,.odt,.pdf,.pptx,.txt,.xls,.xlsx,.zip.
        Other files will be added to a zip archive.

        Options:
              --split             Split large file to zip files (default false)
              -o, --output <name> File name
      ```

      ```md
      >>> file -o "Learn Go with tests.pdf" https://github.com/quii/learn-go-with-tests/releases/download/12.5.0/learn-go-with-tests.pdf


      > [Learn Go with tests.pdf](https://github.com/quii/learn-go-with-tests/releases/download/12.5.0/learn-go-with-tests.pdf)

      [Learn Go with tests.pdf](https://github.com/hellodword/issue-notes/files/1234567/default.pdf)
      ```
    - [ ] delete/del
      ```
      Usage:  >>> delete [LINK]
      ```

      ```md
      >>> delete https://hellodword.github.io/issue-notes/2022/02/03/1-1029028094.html

      or

      >>> delete https://github.com/hellodword/issue-notes/issues/1#issuecomment-1029028094
      ```
    - [ ] code
      ```
      Usage:  >>> code [OPTIONS] [LINK]

        Options:
              --lang  Identifier to enable syntax highlighting
      ```

      ~~~md
      >>> code --lang js https://test.com/test.js

      > [raw](https://test.com/test.js)
      ```js
      ...
      ```
      ~~~
    - [ ] archive
      ```
      Usage:  >>> archive [LINK]
      ```
      ```md
      >>> archive https://tailscale.com/blog/how-nat-traversal-works/
      ```
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

