const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const mongoose = require('mongoose');
const { createObjectCsvWriter } = require('csv-writer');
require('./models/Actor');
const Script = require('./models/Script');
const { getReadablePostImageName } = require('./lib/post-image-name');

function getCondition(postClass) {
    const value = String(postClass || '').toLowerCase();
    if (value.startsWith('c')) return 'con';
    if (value.startsWith('l')) return 'lib';
    return '';
}

function getImageSource(postClass) {
    return String(postClass || '').toLowerCase().includes('ai') ? 'AI' : 'real';
}

async function exportScripts() {
    // Use one stable filename so every export replaces the previous export.
    const outputFilepath = './outputFiles/truman-scripts.csv';

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Successfully connected to db.');

        const scripts = await Script.find({})
            .populate('actor')
            .sort({ postID: 1, class: 1 })
            .lean()
            .exec();

        const records = scripts.map((script) => ({
            MongoScriptId: String(script._id),
            PostID: script.postID,
            StoredPicture: script.picture,
            ImageName: getReadablePostImageName(script),
            Body: script.body,
            Class: script.class,
            Condition: getCondition(script.class),
            ImageSource: getImageSource(script.class),
            ActorUsername: script.actor ? script.actor.username : '',
            ActorName: script.actor && script.actor.profile ? script.actor.profile.name : '',
            TimeMilliseconds: script.time,
            Likes: script.likes,
            Dislikes: script.dislikes,
            Shares: script.shares,
            NumComments: Array.isArray(script.comments) ? script.comments.length : 0,
        }));

        const csvWriter = createObjectCsvWriter({
            path: outputFilepath,
            header: [
                { id: 'MongoScriptId', title: 'MongoScriptId' },
                { id: 'PostID', title: 'PostID' },
                { id: 'StoredPicture', title: 'StoredPicture' },
                { id: 'ImageName', title: 'ImageName' },
                { id: 'Body', title: 'Body' },
                { id: 'Class', title: 'Class' },
                { id: 'Condition', title: 'Condition' },
                { id: 'ImageSource', title: 'ImageSource' },
                { id: 'ActorUsername', title: 'ActorUsername' },
                { id: 'ActorName', title: 'ActorName' },
                { id: 'TimeMilliseconds', title: 'TimeMilliseconds' },
                { id: 'Likes', title: 'Likes' },
                { id: 'Dislikes', title: 'Dislikes' },
                { id: 'Shares', title: 'Shares' },
                { id: 'NumComments', title: 'NumComments' },
            ],
        });

        await csvWriter.writeRecords(records);
        console.log(`Scripts export completed: ${outputFilepath} (${records.length} records).`);
    } finally {
        await mongoose.connection.close();
    }
}

exportScripts().catch((error) => {
    console.error('Scripts export failed:', error);
    process.exitCode = 1;
});
