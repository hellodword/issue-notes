import {
  dateFormat, getPromise
} from './helper'

import {
  parseMarkdown
} from './parse'

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
  let status
  let sha = ''
  let name = ''

  // 404 不存在
  // 200 存在
  status = 0
  try {
    const response = await github.rest.repos.getContent({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: branch,
      path: '_posts'
    })
    if (response.data && response.data.length > 0) {
      for (let i = 0; i < response.data.length; i++) {
        if (response.data[i].name && response.data[i].name.indexOf(`-${issueId}-${issueCommentId}.md`) !== -1) {
          sha = response.data[i].sha
          name = response.data[i].name
          break
        }
      }
      console.log('sha', sha)
      if (!sha || sha === '' || !name || name === '') {
        return
      }
    }
  } catch (error) {
    console.log(error)
    return
  }

  // 201 上传成功
  // 200 更新成功
  status = 0
  try {
    const response = await github.rest.repos.deleteFile({
      owner: context.repo.owner,
      repo: context.repo.repo,
      branch: branch,
      path: `_posts/${name}`,
      message: `delete ${name} via github-actions`,
      sha: sha
    })
    status = response.status
  } catch (error) {
    if (error.response) {
      status = error.response.status
    }
  }

  console.log('delete post', status)
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

  const path = `_posts/${filenamePrefix}-${issueId}-${issueCommentId}.md`
  const branch = 'gh-pages'
  let status
  let sha = ''

  // 404 不存在
  // 200 存在
  status = 0
  try {
    const response = await github.rest.repos.getContent({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: branch,
      path: path
    })
    sha = response.data.sha
    console.log('sha', sha)
  } catch (error) {
    console.log('getContent', error)
  }

  // 201 上传成功
  // 200 更新成功
  status = 0
  try {
    const response = await github.rest.repos.createOrUpdateFileContents({
      owner: context.repo.owner,
      repo: context.repo.repo,
      branch: branch,
      path: path,
      message: `add ${path} via github-actions${'\n\n'}${result.title}${'\n'}${rawLink}`,
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

export default async function entry ({
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
          await createPost(github, context,
            issueId, issueCommentId,
            filenamePrefix, date,
            rawTitle, rawBody, rawLink)
          break
        }
        case 'edited': {
          await createPost(github, context,
            issueId, issueCommentId,
            filenamePrefix, date,
            rawTitle, rawBody, rawLink)
          break
        }
        case 'deleted': {
          await deletePost(github, context,
            issueId, issueCommentId)
          break
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
          await createPost(github, context,
            issueId, issueCommentId,
            filenamePrefix, date,
            rawTitle, rawBody, rawLink)
          break
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
          await createPost(github, context,
            issueId, issueCommentId,
            filenamePrefix, date,
            rawTitle, rawBody, rawLink)
          break
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
          await createPost(github, context,
            issueId, issueCommentId,
            filenamePrefix, date,
            rawTitle, rawBody, rawLink,
            minimized)
          break
        }
        case 'deleted': {
          await deletePost(github, context,
            issueId, issueCommentId)
          break
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
