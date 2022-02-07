import { parsePath } from './helper'

// TODO
// Unhandled error: HttpError: This API returns blobs up to 1 MB in size. The requested blob is too large to fetch via the API, but you can use the Git Data API to request blobs up to 100 MB in size.: {"resource":"Blob","field":"data","code":"too_large"}
export async function getContentSha (github, context, ref, p) {
  let treeSha = ref

  const ps = parsePath(p)
  console.log('parsePath', p, ps)

  for (let i = 0; i < ps.length; i++) {
    try {
      const response = await github.rest.git.getTree({
        owner: context.repo.owner,
        repo: context.repo.repo,
        tree_sha: treeSha
      })
      console.log('getContentSha', 'getTree', response)

      let match = false
      for (let j = 0; j < response.data.tree.length; j++) {
        if (response.data.tree[j].path === ps[i]) {
          treeSha = response.data.tree[j].sha
          match = true
          break
        }
      }
      if (!match) {
        return
      }
    } catch (error) {
      console.log('getContentSha', 'getTree', error)
      return
    }
  }

  if (treeSha === ref) {
    return
  }

  return treeSha
}

export async function matchFile (github, context, sha, cb) {
  try {
    const response = await github.rest.git.getTree({
      owner: context.repo.owner,
      repo: context.repo.repo,
      tree_sha: sha
    })
    console.log('matchFile', 'getTree', response)

    for (let j = 0; j < response.data.tree.length; j++) {
      if (cb(response.data.tree[j].path)) {
        return { sha: response.data.tree[j].sha, name: response.data.tree[j].path }
      }
    }
  } catch (error) {
    console.log('matchFile', 'getTree', error)
  }
}
