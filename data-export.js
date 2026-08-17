const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

require('./models/Script.js');
const User = require('./models/User.js');
const mongoose = require('mongoose');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const {
    getReadablePostImageName,
} = require('./lib/post-image-name');

// Console.log color shortcuts
const color_start = '\x1b[33m%s\x1b[0m'; // yellow
const color_success = '\x1b[32m%s\x1b[0m'; // green
const color_error = '\x1b[31m%s\x1b[0m'; // red

/*
  Gets the user models from the database, or folder of json files.
*/
async function getUserJsons() {
    const users = await User
        .find({ isAdmin: false })
        .populate('feedAction.post')
        .exec();
    return users;
}

function dateMilliseconds(value) {
    const milliseconds = new Date(value).getTime();
    return Number.isFinite(milliseconds) ? milliseconds : null;
}

function addTimedEvents(events, values, type, sequence) {
    for (const value of values || []) {
        const time = dateMilliseconds(value);
        if (time !== null) events.push({ time, type, sequence: sequence.value++ });
    }
}

/**
 * Rebuild the final mutually-exclusive like/dislike state from every duplicate
 * feedAction for a post. The UI sends the opposite "undo" and the new reaction
 * with the same timestamp when a participant switches reactions, so events at
 * the same time are processed with removals first and activations last.
 */
function resolveReactionState(feedActions) {
    let liked = feedActions.some(feedAction => Boolean(feedAction.liked));
    let disliked = feedActions.some(feedAction => Boolean(feedAction.disliked));
    const events = [];
    const sequence = { value: 0 };

    for (const feedAction of feedActions) {
        addTimedEvents(events, feedAction.unlikeTime, 'unlike', sequence);
        addTimedEvents(events, feedAction.undislikeTime, 'undislike', sequence);
        addTimedEvents(events, feedAction.likeTime, 'like', sequence);
        addTimedEvents(events, feedAction.dislikeTime, 'dislike', sequence);
    }

    const priority = { unlike: 0, undislike: 0, like: 1, dislike: 1 };
    events.sort((a, b) =>
        a.time - b.time
        || priority[a.type] - priority[b.type]
        || a.sequence - b.sequence
    );

    for (const event of events) {
        if (event.type === 'like') {
            liked = true;
            disliked = false;
        } else if (event.type === 'unlike') {
            liked = false;
        } else if (event.type === 'dislike') {
            disliked = true;
            liked = false;
        } else if (event.type === 'undislike') {
            disliked = false;
        }
    }

    return { liked, disliked, eventCount: events.length };
}

function resolveToggleState(feedActions, activeField, activateTimes, deactivateTimes) {
    let active = feedActions.some(feedAction => Boolean(feedAction[activeField]));
    const events = [];
    const sequence = { value: 0 };

    for (const feedAction of feedActions) {
        addTimedEvents(events, feedAction[deactivateTimes], false, sequence);
        addTimedEvents(events, feedAction[activateTimes], true, sequence);
    }

    events.sort((a, b) => a.time - b.time || Number(a.type) - Number(b.type) || a.sequence - b.sequence);
    for (const event of events) active = event.type;
    return active;
}

function groupFeedActions(feedActions) {
    const groups = new Map();

    (feedActions || []).forEach((feedAction, index) => {
        const populatedPost = feedAction.post;
        const postId = populatedPost && (populatedPost._id || populatedPost.id || populatedPost);
        // Keep missing/deleted post references separate instead of incorrectly
        // merging every one of them under the same "unknown-image" label.
        const key = postId ? String(postId) : `missing-post-${feedAction._id || index}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(feedAction);
    });

    return [...groups.values()];
}

function mergeActorCommentLikes(feedActions, post) {
    const commentGroups = new Map();

    for (const feedAction of feedActions) {
        for (const commentAction of feedAction.comments || []) {
            if (commentAction.new_comment || !commentAction.comment) continue;
            const key = String(commentAction.comment);
            if (!commentGroups.has(key)) commentGroups.set(key, []);
            commentGroups.get(key).push(commentAction);
        }
    }

    const likedCommentIds = [];
    for (const [commentMongoId, actions] of commentGroups) {
        const liked = resolveToggleState(actions, 'liked', 'likeTime', 'unlikeTime');
        if (!liked) continue;
        const scriptComment = post && (post.comments || []).find(comment =>
            String(comment._id) === commentMongoId
        );
        if (scriptComment) likedCommentIds.push(scriptComment.commentID);
    }

    return likedCommentIds;
}

function mergeNewComments(feedActions, imageName) {
    const comments = new Map();

    for (const feedAction of feedActions) {
        for (const comment of feedAction.comments || []) {
            if (!comment.new_comment) continue;
            const key = comment.new_comment_id != null
                ? `id-${comment.new_comment_id}`
                : String(comment._id);
            if (!comments.has(key)) comments.set(key, comment);
        }
    }

    return [...comments.values()].map(comment => ({
        text: comment.body + ', on Post ' + imageName + ', on Day '
            + (Math.floor(comment.relativeTime / 86400000) + 1) + '\r\n',
    }));
}

async function getDataExport() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(color_success, 'Successfully connected to db.');
    const users = await getUserJsons();
    console.log(color_start, `Starting the data export script...`);
    // Use one stable filename so every export replaces the previous export.
    const outputFilepath = './outputFiles/truman-user-data.csv';
    const csvWriter_header = [
        { id: 'Id', title: process.env.IDENTIFIER },
        { id: 'ProificId', title: 'ProificId' },
        { id: 'NumUserCommentsCreated', title: 'NumUserCommentsCreated' },
        { id: 'NumActorPostsLiked', title: 'NumActorPostsLiked' },
        { id: 'NumActorPostsDisliked', title: 'NumActorPostsDisliked' },
        { id: 'NumActorPostsShared', title: 'NumActorPostsShared' },
        { id: 'NumActorCommentsLiked', title: 'NumActorCommentsLiked' },
        { id: 'UserPostsCreated', title: 'UserPostsCreated' },
        { id: 'UserCommentsCreated', title: 'UserCommentsCreated' },
        { id: 'ActorPostsLiked', title: 'ActorPostsLiked(ImageName)' },
        { id: 'ActorPostsDisliked', title: 'ActorPostsDisliked(ImageName)' },
        { id: 'ActorPostsShared', title: 'ActorPostsShared(ImageName)' },
        { id: 'ActorCommentsLiked', title: 'ActorCommentsLiked' },
        { id: 'TimeOnSite', title: 'TimeOnSite' },
        { id: 'TimeSpentEachPost', title: 'TimeSpentEachPost(ImageName,Time)' },
        { id: 'PageLog', title: 'PageLog' }
    ];
    const csvWriter = createCsvWriter({
        path: outputFilepath,
        header: csvWriter_header
    });
    const records = [];
    const unresolvedReactionConflicts = [];
    // For each user
    for (const user of users) {
        const record = {}; //Record for the user
        record.Id = user.mturkID;
        record.ProificId = user.prolificID;

        let userPostsCreated = "";
        for (const userPost of user.posts) {
            let string = userPost.body + ", on Day " + (Math.floor(userPost.relativeTime / 86400000) + 1) + "\r\n";
            userPostsCreated += string;
        }
        record.NumUserPostsCreated = user.posts.length;
        record.UserPostsCreated = userPostsCreated;
       
        let NumActorPostsLiked = 0,
            NumActorPostsDisliked = 0,
            NumActorPostsShared = 0,
            NumUserCommentsCreated = 0,
            NumActorCommentsLiked = 0;
        let ActorPostsLikedImageNames = [],
            ActorPostsDislikedImageNames = [],
            ActorPostsSharedImageNames = [],
            ActorCommentsLiked = [];
        let UserCommentsCreated = "";
        let TimeSpentEachPostImageNames = [];
        // Merge duplicate feedActions by ScriptMongoId before exporting.
        for (const feedActions of groupFeedActions(user.feedAction)) {
            const post = feedActions.find(feedAction => feedAction.post)?.post;
            const imageName = getReadablePostImageName(post);
            const totalTimeEachPost = feedActions.reduce((postTotal, feedAction) =>
                postTotal + (feedAction.readTime || []).reduce((sum, readTime) =>
                    sum + (Number.isFinite(Number(readTime)) ? Number(readTime) : 0), 0
                ), 0
            );
            TimeSpentEachPostImageNames.push([imageName, totalTimeEachPost]);

            const reactionState = resolveReactionState(feedActions);
            if (reactionState.liked && reactionState.disliked) {
                unresolvedReactionConflicts.push({
                    prolificId: user.prolificID,
                    imageName,
                });
            }
            if (reactionState.liked) {
                NumActorPostsLiked++;
                ActorPostsLikedImageNames.push(imageName);
            }
            if (reactionState.disliked) {
                NumActorPostsDisliked++;
                ActorPostsDislikedImageNames.push(imageName);
            }
            if (resolveToggleState(feedActions, 'shared', 'shareTime', 'unshareTime')) {
                NumActorPostsShared++;
                ActorPostsSharedImageNames.push(imageName);
            }

            const newComments = mergeNewComments(feedActions, imageName);
            NumUserCommentsCreated += newComments.length;
            for (const newComment of newComments) {
                UserCommentsCreated += newComment.text;
            }

            const likedCommentIds = mergeActorCommentLikes(feedActions, post);
            NumActorCommentsLiked += likedCommentIds.length;
            ActorCommentsLiked.push(...likedCommentIds);
        }

        record.NumUserCommentsCreated = NumUserCommentsCreated;
        record.NumActorPostsLiked = NumActorPostsLiked;
        record.NumActorPostsDisliked = NumActorPostsDisliked;
        record.NumActorPostsShared = NumActorPostsShared;
        record.NumActorCommentsLiked = NumActorCommentsLiked;
        record.UserCommentsCreated = UserCommentsCreated;
        record.ActorPostsLiked = ActorPostsLikedImageNames;
        record.ActorPostsDisliked = ActorPostsDislikedImageNames;
        record.ActorPostsShared = ActorPostsSharedImageNames;
        record.ActorCommentsLiked = ActorCommentsLiked;
        //record.TimeSpentEachPost = TimeSpentEachPost;
        record.TimeSpentEachPost = TimeSpentEachPostImageNames
            .map(pair => `[${pair[0]},${pair[1]}]`)
            .join(';');

        record.ActorsBlocked = user.blocked;
        record.ActorsFollowed = user.followed;

        let actorsReported = "";
        for (const reportedActor of user.reported) {
            const reportLogs = user.blockReportAndFollowLog.filter(log => log.action == 'report' && log.actorName == reportedActor);
            for (const reportReason of reportLogs) {
                actorsReported += reportedActor + ", Reported for " + reportReason.report_issue + "\r\n";
            }
        }
        record.ActorsReported = actorsReported;

        record.TimeOnSite = user.pageTimes.reduce((sum, time) => sum + time);
        record.PageLog = user.pageLog.map(pageLog => pageLog.page);

        records.push(record);
    }

    if (unresolvedReactionConflicts.length > 0) {
        throw new Error(
            'Could not determine the final like/dislike state for '
            + `${unresolvedReactionConflicts.length} participant-post combinations: `
            + JSON.stringify(unresolvedReactionConflicts.slice(0, 20))
        );
    }

    await csvWriter.writeRecords(records);
    console.log(color_success, `...Data export completed.\nFile exported to: ${outputFilepath} with ${records.length} records.`);
    console.log(color_success, `...Finished reading from the db.`);
    await mongoose.connection.close();
    console.log(color_start, 'Closed db connection.');
}

if (require.main === module) {
    getDataExport().catch(error => {
        console.error(color_error, `Data export failed: ${error.stack || error}`);
        mongoose.connection.close().catch(() => {});
        process.exitCode = 1;
    });
}

module.exports = {
    groupFeedActions,
    resolveReactionState,
    resolveToggleState,
};
