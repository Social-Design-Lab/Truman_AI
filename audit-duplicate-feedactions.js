const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const fs = require('fs');
const mongoose = require('mongoose');
const { createObjectCsvWriter } = require('csv-writer');
require('./models/Script');
const User = require('./models/User');
const { getReadablePostImageName } = require('./lib/post-image-name');

const outputFilepath = './outputFiles/audit/duplicate-feedactions.csv';

function dates(values) {
    return (values || []).map(value => new Date(value).toISOString());
}

function entryDetails(entry, index) {
    return {
        index,
        feedActionId: String(entry._id),
        liked: Boolean(entry.liked),
        disliked: Boolean(entry.disliked),
        shared: Boolean(entry.shared),
        likeTime: dates(entry.likeTime),
        unlikeTime: dates(entry.unlikeTime),
        dislikeTime: dates(entry.dislikeTime),
        undislikeTime: dates(entry.undislikeTime),
        shareTime: dates(entry.shareTime),
        unshareTime: dates(entry.unshareTime),
        readTimeMs: entry.readTime || [],
        totalReadTimeMs: (entry.readTime || []).reduce((sum, value) => sum + value, 0),
        newCommentCount: (entry.comments || []).filter(comment => comment.new_comment).length,
    };
}

async function auditDuplicateFeedActions() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const users = await User.find({ isAdmin: false })
            .populate('feedAction.post')
            .lean()
            .exec();

        const records = [];

        for (const user of users) {
            const groups = new Map();

            (user.feedAction || []).forEach((entry, index) => {
                if (!entry.post) return;
                const scriptId = String(entry.post._id);
                if (!groups.has(scriptId)) groups.set(scriptId, []);
                groups.get(scriptId).push({ entry, index });
            });

            for (const [scriptId, group] of groups) {
                if (group.length < 2) continue;

                const details = group.map(({ entry, index }) => entryDetails(entry, index));
                const post = group[0].entry.post;
                const valuesFor = field => [...new Set(details.map(detail => detail[field]))];

                records.push({
                    ProlificId: user.prolificID,
                    ScriptMongoId: scriptId,
                    ImageName: getReadablePostImageName(post),
                    PostBody: post.body,
                    DuplicateEntryCount: group.length,
                    ExtraEntryCount: group.length - 1,
                    LikedStateConflict: valuesFor('liked').length > 1,
                    DislikedStateConflict: valuesFor('disliked').length > 1,
                    SharedStateConflict: valuesFor('shared').length > 1,
                    SummedReadTimeMs: details.reduce((sum, detail) => sum + detail.totalReadTimeMs, 0),
                    EntryDetailsJSON: JSON.stringify(details),
                });
            }
        }

        records.sort((a, b) =>
            a.ProlificId.localeCompare(b.ProlificId)
            || a.ImageName.localeCompare(b.ImageName)
        );

        await fs.promises.mkdir('./outputFiles/audit', { recursive: true });
        const csvWriter = createObjectCsvWriter({
            path: outputFilepath,
            header: [
                { id: 'ProlificId', title: 'ProlificId' },
                { id: 'ScriptMongoId', title: 'ScriptMongoId' },
                { id: 'ImageName', title: 'ImageName' },
                { id: 'PostBody', title: 'PostBody' },
                { id: 'DuplicateEntryCount', title: 'DuplicateEntryCount' },
                { id: 'ExtraEntryCount', title: 'ExtraEntryCount' },
                { id: 'LikedStateConflict', title: 'LikedStateConflict' },
                { id: 'DislikedStateConflict', title: 'DislikedStateConflict' },
                { id: 'SharedStateConflict', title: 'SharedStateConflict' },
                { id: 'SummedReadTimeMs', title: 'SummedReadTimeMs' },
                { id: 'EntryDetailsJSON', title: 'EntryDetailsJSON' },
            ],
        });

        await csvWriter.writeRecords(records);
        const participantCount = new Set(records.map(record => record.ProlificId)).size;
        console.log(
            `Duplicate audit completed: ${outputFilepath} `
            + `(${participantCount} participants, ${records.length} participant-image groups).`
        );
    } finally {
        await mongoose.connection.close();
    }
}

auditDuplicateFeedActions().catch(error => {
    console.error('Duplicate feedAction audit failed:', error);
    process.exitCode = 1;
});
