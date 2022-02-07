export async function getContentSha (github, context, ref, path, cb) {
  try {
    const response = await github.rest.repos.getContent({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: ref,
      path: path
    })
    if (response.data && response.data.length > 0) {
      for (let i = 0; i < response.data.length; i++) {
        if (response.data[i].name && cb(response.data[i].name)) {
          return { sha: response.data[i].sha, name: response.data[i].name }
        }
      }
    } else if (response.data && response.data.sha) {
      return { sha: response.data.sha, name: response.data.name }
    }
    return { sha: '' }
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return { sha: '' }
    }
    throw error
  }
}
