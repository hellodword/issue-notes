const fs = require('fs');
const path = require('path');

async function* walk(dir) {
    for await (const d of await fs.promises.opendir(dir)) {
        const entry = path.join(dir, d.name);
        if (d.isDirectory()) yield* walk(entry);
        else if (d.isFile()) yield entry;
    }
}


function postTemplate(date, title, body, published) {
    return `---
layout: post
published: ${published}
title:  |
    ${title}
date:   ${date}
---

${body}
`;
}

function prepareBasedir(basedir) {
    try {
        if (!fs.existsSync(basedir)) {
            fs.mkdirSync(basedir);
        }
    } catch (err) {
        throw (err);
    }
}

function postPath(basedir, filenamePrefix, filenameId) {
    const filename = `${filenamePrefix}-${filenameId}.md`;
    return path.join(basedir, filename);
}

function createPost(basedir, filenamePrefix, filenameId, date, title, body, published) {
    const totalPath = postPath(basedir, filenamePrefix, filenameId);
    console.log('totalPath', totalPath);

    const post = postTemplate(date, title, body, published);

    try {
        fs.writeFileSync(totalPath, post);
    } catch (err) {
        throw (err)
    }
}

function deletePost(basedir, filenamePrefix, filenameId) {
    const totalPath = postPath(basedir, filenamePrefix, filenameId);
    console.log('totalPath', totalPath);


    try {
        fs.accessSync(totalPath, fs.constants.R_OK | fs.constants.W_OK);
        try {
            fs.unlinkSync(totalPath);
        } catch (err) {
            throw (err);
        }
    } catch (err) {
        console.log(err);
    }


}

function pad2(n) {
    return (n < 10 ? '0' : '') + n;
}

function dateFormat(created_at) {
    let date = new Date(created_at);
    let s = `${date.getFullYear()}-${pad2((date.getMonth() + 1))}-${pad2(date.getDate())}`;
    if (!new RegExp(/^\d{4}\-\d{2}\-\d{2}/).test(s)) {
        throw (created_at);
    }
    return s;
}

function titleFromBody(body) {
    let ss = body.replace(/\r/g, '').split('\n')
    let title = '';
    for (let s of ss) {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions/Cheatsheet
        if (!new RegExp(/^[ \f\t\v\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*$/).test(s)) {
            title = s.replace(/^ *#+ +/, '');
            break;
        }
    }

    if (title == '') {
        throw (body);
    }
    return title;
}

module.exports = async ({
    github,
    context,
    core
}) => {
    console.log('context.eventName', context.eventName)
    console.log('context.payload.action', context.payload.action)

    const basedir = path.join(process.cwd(), 'gh-pages', '_posts');
    prepareBasedir(basedir);

    switch (context.eventName) {
        case 'issues': {
            const filenamePrefix = dateFormat(context.payload.issue.created_at);
            const filenameId = `${context.payload.issue.number}-0`;
            const body = context.payload.issue.body;
            const title = context.payload.issue.title;
            const date = context.payload.issue.updated_at ? context.payload.issue.updated_at : context.payload.issue.created_at;
            console.log('filenamePrefix', filenamePrefix);
            console.log('filenameId', filenameId);
            switch (context.payload.action) {
                case 'opened': {
                    createPost(basedir, filenamePrefix, filenameId, date, title, body, true);
                    break;
                }
                case 'edited': {
                    createPost(basedir, filenamePrefix, filenameId, date, title, body, true);
                    break;
                }
                case 'deleted': {
                    deletePost(basedir, filenamePrefix, filenameId);
                    break;
                }
                case 'transferred': {
                    console.log('Unsupported yet');
                    break;
                }
                case 'pinned': {
                    console.log('Unsupported yet');
                    break;
                }
                case 'unpinned': {
                    console.log('Unsupported yet');
                    break;
                }
                case 'closed': {
                    console.log('Unsupported yet');
                    break;
                }
                case 'reopened': {
                    createPost(basedir, filenamePrefix, filenameId, date, title, body, true);
                    break;
                }
                case 'assigned': {
                    console.log('Unsupported yet');
                    break;
                }
                case 'unassigned': {
                    console.log('Unsupported yet');
                    break;
                }
                case 'labeled': {
                    console.log('Unsupported yet');
                    break;
                }
                case 'unlabeled': {
                    console.log('Unsupported yet');
                    break;
                }
                case 'locked': {
                    console.log('Unsupported yet');
                    break;
                }
                case 'unlocked': {
                    console.log('Unsupported yet');
                    break;
                }
                case 'milestoned': {
                    console.log('Unsupported yet');
                    break;
                }
                case 'demilestoned': {
                    console.log('Unsupported yet');
                    break;
                }
                default: {
                    console.log('unkown event action:', context.eventName, context.payload.action)
                    break;
                }
            }
            break;
        }
        case 'issue_comment': {
            const filenamePrefix = dateFormat(context.payload.comment.created_at);
            const filenameId = `${context.payload.issue.number}-${context.payload.comment.id}`;
            const body = context.payload.comment.body;
            const title = titleFromBody(body);
            const date = context.payload.comment.updated_at ? context.payload.comment.updated_at : context.payload.comment.created_at;
            console.log('filenamePrefix', filenamePrefix);
            console.log('filenameId', filenameId);
            switch (context.payload.action) {
                case 'created': {
                    createPost(basedir, filenamePrefix, filenameId, date, title, body, true);
                    break;
                }
                case 'edited': {
                    createPost(basedir, filenamePrefix, filenameId, date, title, body, true);
                    break;
                }
                case 'deleted': {
                    deletePost(basedir, filenamePrefix, filenameId);
                    break;
                }
                default: {
                    console.log('unkown event action:', context.eventName, context.payload.action)
                    break;
                }
            }
            break;
        }
        default: {
            console.log('unkown event:', context.eventName)
            break;
        }
    }
}