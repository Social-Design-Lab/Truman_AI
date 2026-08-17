const { expect } = require('chai');
const {
    groupFeedActions,
    resolveReactionState,
    resolveToggleState,
} = require('../data-export');

describe('clean data export helpers', function () {
    it('groups duplicate feedActions by post id', function () {
        const groups = groupFeedActions([
            { _id: 'a', post: { _id: 'post-1' } },
            { _id: 'b', post: { _id: 'post-2' } },
            { _id: 'c', post: { _id: 'post-1' } },
        ]);

        expect(groups.map(group => group.length)).to.deep.equal([2, 1]);
    });

    it('resolves a same-time unlike then dislike switch as disliked', function () {
        const time = new Date('2026-06-03T20:12:48.800Z');
        const state = resolveReactionState([
            { liked: true, unlikeTime: [time] },
            { disliked: true, dislikeTime: [time] },
        ]);

        expect(state).to.include({ liked: false, disliked: true });
    });

    it('resolves a same-time undislike then like switch as liked', function () {
        const time = new Date('2026-06-03T20:12:48.800Z');
        const state = resolveReactionState([
            { disliked: true, undislikeTime: [time] },
            { liked: true, likeTime: [time] },
        ]);

        expect(state).to.include({ liked: true, disliked: false });
    });

    it('uses the latest share or unshare event across duplicates', function () {
        const state = resolveToggleState([
            { shared: true, shareTime: [new Date('2026-01-01T00:00:00Z')] },
            { shared: false, unshareTime: [new Date('2026-01-01T00:00:01Z')] },
        ], 'shared', 'shareTime', 'unshareTime');

        expect(state).to.equal(false);
    });
});
