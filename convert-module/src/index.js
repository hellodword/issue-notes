import {
  dateFormat, getPromise
} from './helper'

import {
  parseMarkdown
} from './parse'

import {
  getContentSha,
  matchFile
} from './octokit'
import fs from 'fs'
import path from 'path'
import { sanitize } from 'string-sanitizer'
export { sanitize } from 'string-sanitizer'

export * from './helper'
export * from './parse'
export * from './octokit'

function postTemplate (date, title, body, description, jumplink, published, author) {
  let desc = ''
  if (description && description !== '') {
    desc = 'description:  |\n'
    desc += description.replace(/^[ \t]*/gm, '  ')
  }

  let jl = ''
  if (jumplink) {
    jl = `jumplink: ${jumplink}`
  }

  if (!author || author === '') {
    author = 'Notes'
  }

  return `---
layout: post
published: ${published}
author: ${author}
title:  |
  ${title}
date:   ${date}
${desc}
${jl}
---

${body}
`
}

async function deletePost (github, context,
  issueId, issueCommentId) {
  const branch = 'gh-pages'
  const dir = '_posts'

  const shaParent = await getContentSha(github, context, branch, dir)
  if (!shaParent || shaParent === '') {
    return
  }

  let sha = {}
  sha = await matchFile(github, context,
    shaParent,
    (item) => {
      console.log('deletePost', 'cb', item, `-${issueId}-${issueCommentId}.md`)
      return item.indexOf(`-${issueId}-${issueCommentId}.md`) !== -1
    })

  console.log('deletePost', sha)
  if (!sha || !sha.sha || sha.sha === '' || !sha.name || sha.name === '') {
    return
  }

  // 这里不 catch
  const response = await github.rest.repos.deleteFile({
    owner: context.repo.owner,
    repo: context.repo.repo,
    branch: branch,
    path: `${dir}/${sha.name}`,
    message: `delete ${sha.name} via github-actions`,
    sha: sha.sha || ''
  })
  console.log('deletePost', response)
}

async function createPost (github, context,
  issueId, issueCommentId,
  filenamePrefix, date,
  rawTitle, rawBody, rawLink,
  minimized
) {
  console.log('rawLink', rawLink)
  console.log('rawTitle', rawTitle)
  console.log('rawBody', rawBody)
  console.log('published', !minimized)

  const result = await parseMarkdown(github, context,
    filenamePrefix, rawLink,
    rawBody)
  console.log('parse', result)

  if (result.del) {
    console.log('delete', result.del)
    // https://.../2022/02/03/1-1029028094.html
    // https://.../issues/1#issuecomment-1029028094
    const regex = /(\/(\d+)-(\d+)\.html)|(\/(\d+)#issuecomment-(\d+)$)/
    for (let i = 0; i < result.del.length; i++) {
      const m = regex.exec(result.del[i])
      const issueId = m[2] || m[5]
      const issueCommentId = m[3] || m[6]
      deletePost(github, context, issueId, issueCommentId)
    }
    return
  }

  // 留待 actions 进行 archive
  if (result.archive) {
    result.archive.args.title = result.archive.args.title || result.title
    result.archive.args.author = result.archive.args.author || result.author
    return result.archive.args
  }

  if (rawTitle && rawTitle !== '') {
    result.title = rawTitle
  }

  if (!result.body || result.body === '') {
    result.body = rawBody
  }

  if (result.descriptions) {
    result.description = result.descriptions.join('\n')
  }

  const post = postTemplate(date, result.title, result.body, result.description, result.jumplink, !minimized, result.author)

  const pathPost = `_posts/${filenamePrefix}-${issueId}-${issueCommentId}.md`
  const branch = 'gh-pages'

  const sha = await getContentSha(github, context, branch, `_posts/${filenamePrefix}-${issueId}-${issueCommentId}.md`)

  // 201 上传成功
  // 200 更新成功
  let status = 0
  try {
    const response = await github.rest.repos.createOrUpdateFileContents({
      owner: context.repo.owner,
      repo: context.repo.repo,
      branch: branch,
      path: pathPost,
      message: `add ${pathPost} via github-actions${'\n\n'}${result.title}${'\n'}${rawLink}`,
      content: Buffer.from(post, 'utf8').toString('base64'),
      sha: sha
    })
    status = response.status
  } catch (error) {
    console.log('createOrUpdateFileContents', error)
    if (error.response) {
      status = error.response.status
    }
  }

  if (status === 200 || status === 201 || status === 422) {
    // 成功
    if (result.issueNeedEdit) {
      if (issueCommentId === 0) {
        const response = await github.rest.issues.update({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: issueId,
          body: result.issueBody,
          title: result.title
        })
        console.log('issues.update', response)
      } else {
        const response = await github.rest.issues.updateComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          comment_id: issueCommentId,
          body: result.issueBody
        })
        console.log('issues.updateComment', response)
      }
    }
  } else {
    throw new Error(`status=${status}`)
  }
}

export async function convertEntry ({
  github,
  context,
  core
}) {
  console.log('context.eventName', context.eventName)
  console.log('context.payload.action', context.payload.action)

  switch (context.eventName) {
    case 'issues': {
      const filenamePrefix = dateFormat(new Date(context.payload.issue.created_at))
      const issueId = context.payload.issue.number
      const issueCommentId = 0
      const rawLink = `https://github.com/${context.repo.owner}/${context.repo.repo}/issues/${context.payload.issue.number}`
      let date = context.payload.issue.updated_at
      if (!date) {
        date = context.payload.issue.created_at
      }

      console.log('filenamePrefix', filenamePrefix)
      console.log('issueId', issueId)
      console.log('date', date)
      console.log('rawLink', rawLink)

      const rawBody = context.payload.issue.body
      const rawTitle = context.payload.issue.title

      switch (context.payload.action) {
        case 'opened': {
          return await createPost(github, context,
            issueId, issueCommentId,
            filenamePrefix, date,
            rawTitle, rawBody, rawLink)
        }
        case 'edited': {
          return await createPost(github, context,
            issueId, issueCommentId,
            filenamePrefix, date,
            rawTitle, rawBody, rawLink)
        }
        case 'deleted': {
          return await deletePost(github, context,
            issueId, issueCommentId)
        }
        case 'transferred': {
          console.log('Unsupported yet')
          break
        }
        case 'pinned': {
          console.log('Unsupported yet')
          break
        }
        case 'unpinned': {
          console.log('Unsupported yet')
          break
        }
        case 'closed': {
          console.log('Unsupported yet')
          break
        }
        case 'reopened': {
          return await createPost(github, context,
            issueId, issueCommentId,
            filenamePrefix, date,
            rawTitle, rawBody, rawLink)
        }
        case 'assigned': {
          console.log('Unsupported yet')
          break
        }
        case 'unassigned': {
          console.log('Unsupported yet')
          break
        }
        case 'labeled': {
          console.log('Unsupported yet')
          break
        }
        case 'unlabeled': {
          console.log('Unsupported yet')
          break
        }
        case 'locked': {
          console.log('Unsupported yet')
          break
        }
        case 'unlocked': {
          console.log('Unsupported yet')
          break
        }
        case 'milestoned': {
          console.log('Unsupported yet')
          break
        }
        case 'demilestoned': {
          console.log('Unsupported yet')
          break
        }
        default: {
          console.log('unkown event action:', context.eventName, context.payload.action)
          break
        }
      }
      break
    }
    case 'issue_comment': {
      const filenamePrefix = dateFormat(new Date(context.payload.comment.created_at))
      const issueId = context.payload.issue.number
      const issueCommentId = context.payload.comment.id
      const rawLink = `https://github.com/${context.repo.owner}/${context.repo.repo}/issues/${context.payload.issue.number}#issuecomment-${context.payload.comment.id}`
      let date = context.payload.comment.updated_at
      if (!date) {
        date = context.payload.comment.created_at
      }

      console.log('filenamePrefix', filenamePrefix)
      console.log('issueId', issueId)
      console.log('date', date)
      console.log('rawLink', rawLink)

      const rawBody = context.payload.comment.body
      const rawTitle = context.payload.comment.title

      switch (context.payload.action) {
        case 'created': {
          return await createPost(github, context,
            issueId, issueCommentId,
            filenamePrefix, date,
            rawTitle, rawBody, rawLink)
        }
        case 'edited': {
          let minimized = false
          // hide(minimize)/unhide 会触发 edited，但是 event payload 中不会有信息。
          // github 没有提供 api，请求页面来判断
          /*
            <div class=" timeline-comment-group js-minimizable-comment-group js-targetable-element TimelineItem-body my-0 " id="issuecomment-1030642768">
      <clipboard-copy aria-label="Copy link" for="issuecomment-1030642768-permalink" role="menuitem" data-view-component="true" class="dropdown-item btn-link">
      <a href="#issuecomment-1030642768" id="issuecomment-1030642768-permalink" class="Link--secondary js-timestamp"><relative-time datetime="2022-02-05T15:15:39Z" class="no-wrap">Feb 5, 2022</relative-time></a>
      <!-- '"` --><!-- </textarea></xmp> --></option></form><form class="js-comment-update" id="issuecomment-1030642768-edit-form" action="/hellodword/issue-notes/issue_comments/1030642768" accept-charset="UTF-8" method="post"><input type="hidden" name="_method" value="put" autocomplete="off" /><input type="hidden" data-csrf="true" name="authenticity_token" value="88LmFZZSuYGVhpWnJnbnOwfmv8PdsmLaiiqvQdz5kD5g56U2jpNyw4xoB8Y7p4ATOgBrn5wg4F220Ce/8Ayrmg==" />
  src="/hellodword/issue-notes/issue_comments/1030642768/edit_form?textarea_id=issuecomment-1030642768-body&amp;comment_context="
          */
          if (context.payload.changes && context.payload.changes.body && context.payload.changes.body.from &&
            context.payload.changes.body.from === context.payload.comment.body) {
            try {
              const r = await getPromise(`https://github.com/${context.repo.owner}/${context.repo.repo}/issues/${context.payload.issue.number}`)
              console.log('html', r.body.toString())
              if (new RegExp(`"issuecomment-${context.payload.comment.id}"`, 'gm').test(r.body.toString()) &&
              !new RegExp(`"issuecomment-${context.payload.comment.id}-permalink"`, 'gm').test(r.body.toString())) {
                minimized = true
              }
            } catch (error) {
              console.log(error)
            }
          }
          return await createPost(github, context,
            issueId, issueCommentId,
            filenamePrefix, date,
            rawTitle, rawBody, rawLink,
            minimized)
        }
        case 'deleted': {
          return await deletePost(github, context,
            issueId, issueCommentId)
        }
        default: {
          console.log('unkown event action:', context.eventName, context.payload.action)
          break
        }
      }
      break
    }
    default: {
      console.log('unkown event:', context.eventName)
      break
    }
  }
}

function findArchives (folderPath) {
  let directory
  try {
    directory = fs.opendirSync(folderPath)
    if (!directory) {
      return
    }
  } catch (error) {
    return
  }

  const result = []
  while (1) {
    const d = directory.readSync()
    if (!d) {
      break
    }
    if (!d.isDirectory()) {
      continue
    }
    const p = path.join(folderPath, d.name, 'index.html')
    try {
      if (fs.statSync(p)) {
        console.log(p)
        result.push(d.name)
      }
    } catch (error) {}
  }
  return result
}

export const ArchiveEngines = [
  'ArchiveBox',
  'cairn',
  'obelisk',
  'rivet'
]

export async function archiveEntry ({
  github,
  context,
  core,
  archive
}) {
  const filename = sanitize(archive.link)

  let headArchives = ''
  for (let i = 0; i < ArchiveEngines.length; i++) {
    headArchives += `
  - name: ${ArchiveEngines[i]}
    url: "/archives/${ArchiveEngines[i].toLowerCase()}/${filename}.html"
`
  }

  // 先把 _post 写了
  const contentPost = `---
layout: null
title: |
  ${archive.title}
author: "${archive.author || 'Archive'}"
jumplink: ${archive.link}
archives: ${headArchives}
---

[${archive.title}](${archive.link})
`

  // 获取日期
  let date = archive.date
  if (!date || date === '') {
    if (context.eventName === 'issue_comment') {
      date = context.payload.issue.updated_at || context.payload.issue.created_at
    } else {
      date = context.payload.comment.updated_at || context.payload.comment.created_at
    }
    date = dateFormat(new Date(date))
  }

  let rawLink = `https://github.com/${context.repo.owner}/${context.repo.repo}/issues/${context.payload.issue.number}`
  if (context.eventName === 'issue_comment') {
    rawLink = `https://github.com/${context.repo.owner}/${context.repo.repo}/issues/${context.payload.issue.number}#issuecomment-${context.payload.comment.id}`
  }

  const pathPost = `_posts/archives/${date}-${filename}.md`
  const branchPost = 'gh-pages'

  const shaPost = await getContentSha(github, context, branchPost, pathPost)

  // 201 上传成功
  // 200 更新成功
  let statusPost = 0
  try {
    const response = await github.rest.repos.createOrUpdateFileContents({
      owner: context.repo.owner,
      repo: context.repo.repo,
      branch: branchPost,
      path: pathPost,
      message: `archive ${date}-${filename} via github-actions${'\n\n'}${archive.title}${'\n'}${archive.link}${'\n'}${rawLink}`,
      content: Buffer.from(contentPost, 'utf8').toString('base64'),
      sha: shaPost
    })
    statusPost = response.status
  } catch (error) {
    console.log('createOrUpdateFileContents', error)
    if (error.response) {
      statusPost = error.response.status
    }
  }

  console.log('createOrUpdateFileContents', statusPost)

  let archives = findArchives(path.join(process.cwd(), 'archives'))
  console.log('archives', archives)
  archives = archives || []

  for (let i = 0; i < archives.length; i++) {
    console.log('archiving', archives[i])
    //     const contentArchive = `---
    // layout: null
    // title: "[archive][${archive.engine}] ${archive.title}"
    // author: "${archive.author || 'Archive'}"
    // ---
    // {{ "${encodeURIComponent(fs.readFileSync(path.join(process.cwd(), 'archives', archives[i], 'index.html')).toString())}" | url_decode }}
    // `
    // 不需要 jekyll header 了
    const contentArchive = fs.readFileSync(path.join(process.cwd(), 'archives', archives[i], 'index.html'))
    const pathArchive = `archives/${archives[i]}`
    const branchArchive = 'gh-pages'

    console.log('archiving', archives[i], pathArchive, filename)

    const shaArchive = await getContentSha(github, context, branchArchive, `${pathArchive}/${filename}.html`)

    console.log('archiving', archives[i], 'shaArchive', shaArchive)

    // 201 上传成功
    // 200 更新成功
    let statusArchive = 0
    try {
      const response = await github.rest.repos.createOrUpdateFileContents({
        owner: context.repo.owner,
        repo: context.repo.repo,
        branch: branchArchive,
        path: `${pathArchive}/${filename}.html`,
        message: `archive engine ${archives[i]} ${filename} via github-actions${'\n\n'}${archive.title}${'\n'}${archive.link}`,
        content: contentArchive.toString('base64'),
        sha: shaArchive
      })
      statusArchive = response.status
    } catch (error) {
      console.log('archiving', archives[i], 'createOrUpdateFileContents', error)
      if (error.response) {
        statusArchive = error.response.status
      }
    }

    console.log('archiving', archives[i], 'createOrUpdateFileContents', statusArchive)
  }
}
