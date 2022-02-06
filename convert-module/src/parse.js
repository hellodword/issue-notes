import {
  remark
} from 'remark'

import {
  visit
} from 'unist-util-visit'

import {
  split
} from 'shlex'
import Yargs from 'yargs'

import crypto from 'crypto'
import { getPromise } from './helper'

import contentDisposition from 'content-disposition'

function isInlineCommand (node) {
  return node.children &&
    node.children.length === 1 &&
    node.children[0].type === 'blockquote' &&
    // 2
    node.children[0].children &&
    node.children[0].children.length === 1 &&
    node.children[0].children[0].type === 'blockquote' &&
    // 3
    node.children[0].children[0].children &&
    node.children[0].children[0].children.length === 1 &&
    node.children[0].children[0].children[0].type === 'paragraph' &&
    // 适配 >>> code `http://a.b/__init__.py` 防止转义
    // >>> cmd `a` b `c`
    // 4
    node.children[0].children[0].children[0].children &&
    node.children[0].children[0].children[0].children.length >= 1 &&
    (node.children[0].children[0].children[0].children[0].type === 'text' || node.children[0].children[0].children[0].children[0].type === 'inlineCode')
}

function getInlineCommand (node) {
  const result = []
  const paragraph = node.children[0].children[0].children[0].children
  for (let i = 0; i < paragraph.length; i++) {
    if (paragraph[i].value && paragraph[i].value !== '') {
      result.push(paragraph[i].value)
    }
  }
  return result
}

function markInlineCommand (tree) {
  tree.isInlineCommand = true
  // visit(tree, (children) => {
  //   children.isInlineCommand = true
  // })
}

function isURL (s) {
  const regex = /^https?:\/\/[^\r\n]+$/
  return regex.test(s)
}

function onlyTitleAndLink (node) {
  return node.children &&
    node.children.length === 2 &&
    node.children[1].type === 'paragraph' &&
    isURL(getText(node.children[1])) &&
    (node.children[0].type === 'heading' || node.children[0].type === 'paragraph')
}

function getText (heading) {
  let result = ''
  visit(heading, (node) => {
    if ((!result || result === '') && node.type === 'text') {
      result = node.value
    }
  })
  return result
}

async function myRemarkPlugin (tree, result) {
  let last = {}
  visit(tree, (node, index, parent) => {
    console.log(node)
    node.rawParent = parent
    node.rawIndex = index
    switch (node.type) {
      case 'blockquote': {
        if (node.type === 'blockquote' && last.type !== 'blockquote') {
          if (isInlineCommand(node)) {
            markInlineCommand(node)
            // console.log('getInlineCommand', getInlineCommand(node))
            const textNode = node.children[0].children[0].children[0].children[0]
            Yargs(split(getInlineCommand(node).join(' ')))
              .command({
                command: 'desc <descriptions...>',
                desc: 'define the descriptions',
                handler: (args) => {
                  if (!result.descriptions) {
                    result.descriptions = args.descriptions
                  } else {
                    result.descriptions.push(...args.descriptions)
                  }
                }
              })
              .command({
                command: 'author [author]',
                desc: 'define the author',
                handler: (args) => {
                  result.author = args.author
                }
              })
              .command({
                command: 'img [link]',
                desc: '',
                handler: (args) => {
                  result.img = {
                    node: node,
                    args: args,
                    children: textNode.children
                  }
                }
              })
              .command({
                command: 'jump [link]',
                desc: '',
                handler: (args) => {
                  result.jumplink = args.link
                }
              })
              .command({
                command: 'del [link]',
                desc: '',
                handler: (args) => {
                  console.log(args.link)
                  if (!result.del) {
                    result.del = []
                  }
                  result.del.push(args.link)
                }
              })
              .command({
                command: 'code [link]',
                desc: 'download remote code and insert code block',
                builder: yargs => yargs.options({
                  lang: {
                    description: 'language'
                  },
                  name: {
                    description: 'filename'
                  }
                }),
                handler: (args) => {
                  result.code = {
                    node: node,
                    args: args,
                    children: textNode.children
                  }
                }
              })
              .command({
                command: 'archive [link]',
                desc: 'web archiving with archivebox',
                builder: yargs => yargs.options({
                  title: {
                    description: '标题'
                  },
                  author: {
                    description: '作者'
                  },
                  engine: {
                    description: '引擎'
                  },
                  date: {
                    description: 'date'
                  }
                }),
                handler: (args) => {
                  result.archive = {
                    node: node,
                    args: args,
                    children: textNode.children
                  }
                }
              })
              .parse()
          }
        }
        break
      }
      // case 'heading': {
      //   if (!result.title || result.title === '') {
      //     result.title = getText(node);
      //   }
      //   break;
      // }
      case 'text': {
        if (!result.title || result.title === '') {
          result.title = getText(node) // 取第一个 text 为 title
        }
        break
      }
      default: {
        // console.log(node.type);
        break
      }
    }
    last = node
  })
}

export async function parseMarkdown (github, context, filenamePrefix, rawLink, markdown) {
  console.log('markdown', markdown)
  const result = {}
  result.tree = remark()
    // .use(myRemarkPlugin(result))
    .parse(markdown)

  // console.log(result.tree);

  await myRemarkPlugin(result.tree, result)

  if (result.code) {
    // TODO 支持 github permalink 预览
    //      例如 https://github.com/torvalds/linux/blob/90c9e950c0def5c354b4a6154a2ddda3e5f214ac/Makefile#L14-L19
    //      在 issue 中默认就可以预览
    //      在域名为 *.github.io 中，改成对应的 raw.githubusercontent.com 域名的链接就没有跨域问题
    //      https://raw.githubusercontent.com/torvalds/linux/90c9e950c0def5c354b4a6154a2ddda3e5f214ac/Makefile
    //      解析一下行信息即可
    try {
      const r = await getPromise(result.code.args.link)
      if (r.response.statusCode !== 200) {
        throw new Error(`code response statusCode ${r.response.statusCode} url ${result.code.args.link}`)
      }
      // 优先用传参
      let fileName = result.code.args.name

      // 其次读取 content-disposition
      if (r.response.header && r.response.header['content-disposition'] && r.response.header['content-disposition'] !== '') {
        const disposition = contentDisposition.parse(r.response.header['content-disposition'])
        if (disposition && disposition.parameters) {
          if (disposition.parameters.filename && disposition.parameters.filename !== '') {
            if (!fileName || fileName === '') {
              fileName = disposition.parameters.filename
            }
          }
          if (disposition.parameters.name && disposition.parameters.name !== '') {
            if (!fileName || fileName === '') {
              fileName = disposition.parameters.name
            }
          }
        }
      }

      // 最后尝试根据 url 来获取
      if (!fileName || fileName === '') {
        const url = new URL(result.code.args.link)
        fileName = url.pathname.match(/[^/]+$/)[0]
      }

      // 尝试从 fileName 中获取 lang
      if (!result.code.args.lang || result.code.args.lang === '') {
        result.code.args.lang = fileName.match(/[^.]+$/)[0]
      }

      const cmd = getInlineCommand(result.code.node).join(' ')
      result.code.node.type = 'html'
      result.code.node.value = `<!-- ${cmd} -->`
      result.code.node.children = undefined

      result.code.node.rawParent.children.push({
        type: 'code',
        lang: result.code.args.lang || 'txt',
        value: r.body.toString()
      })

      // result.code.node.type = 'code'
      // result.code.node.lang = result.code.args.lang || 'txt'
      // result.code.node.meta = null

      // TODO {"resource":"IssueComment","code":"custom","field":"body","message":"body is too long (maximum is 65536 characters)"}
      //      超过限制的文件下载到 assets 分支，生成 jekyll post，修改 issue 中的链接为 assets 链接
      // result.code.node.value = r.body.toString()

      // result.code.node.children = result.code.children
      result.issueNeedEdit = true
    } catch (error) {
      console.log(error)
    }
  }

  if (result.img) {
    result.img.node.type = 'image'
    result.img.node.title = null
    result.img.node.alt = result.img.args.link
    result.img.node.url = result.img.args.link

    try {
      const r = await getPromise(result.img.args.link)
      if (r.response.statusCode !== 200) {
        throw new Error(`img response statusCode ${r.response.statusCode} url ${result.img.args.link}`)
      }
      // sha1
      const hash = crypto.createHash('sha1')
      hash.update(r.body)
      const sha1Hex = hash.digest('hex')

      if (github) {
        // 422 已上传
        // 201 上传成功
        const branch = 'assets'

        let status
        try {
          const response = await github.rest.repos.createOrUpdateFileContents({
            owner: context.repo.owner,
            repo: context.repo.repo,
            branch: branch,
            // TODO 识别图片后缀
            path: `${filenamePrefix}/${sha1Hex}.jpg`,
            message: `add ${sha1Hex}.jpg via github-actions${'\n\n'}${rawLink}${'\n'}${result.img.args.link}`,
            content: r.toString('base64')
          })
          status = response.status
        } catch (error) {
          console.log('createOrUpdateFileContents', error)
          if (error.response) {
            status = error.response.status
          }
        }

        if (status === 201 || status === 422) {
          result.img.node.url =
            result.img.node.url = `https://raw.githubusercontent.com/${context.repo.owner}/${context.repo.repo}/${branch}/${filenamePrefix}/${sha1Hex}.jpg`
        }
      }
    } catch (error) {
      console.log('createOrUpdateFileContents', error)
    }

    result.img.node.children = result.img.children

    result.issueNeedEdit = true
  }

  result.body = remark().stringify(result.tree)

  // 只有链接
  if (isURL(result.title) && result.body.replace(/\n/g, '') === result.title) {
    // TODO 抓取标题
    result.body = `[${result.title}](${result.title})`
    result.jumplink = result.title
    result.issueNeedEdit = false
  }

  // 只有标题和链接
  if (onlyTitleAndLink(result.tree)) {
    const link = getText(result.tree.children[1])
    const title = getText(result.tree.children[0])
    result.body = `[${title}](${link})`
    result.jumplink = link
    result.issueNeedEdit = false
    result.title = title
  }

  result.issueBody = result.body

  console.log(result.body)
  console.log(result.issueBody)
  return result
}
