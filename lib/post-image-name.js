const path = require('path');

/**
 * Convert the internal numeric image filename used by Truman into the
 * human-readable filename used by the study materials.
 *
 * The database image order differs from the study topic order: t03 (the
 * police topic) is stored as image pair 10, after t10. This explicit mapping
 * preserves the study-material names. Odd-numbered images are conservative
 * condition (con), even-numbered images are liberal condition (lib), and the
 * post class identifies AI versus real images.
 */
function getReadablePostImageName(post) {
    if (!post || !post.picture) return 'unknown-image';

    const storedFilename = path.basename(String(post.picture));
    const match = storedFilename.match(/^(\d+)\.[^.]+$/);

    // If the database already contains a descriptive filename, keep it.
    if (!match) return storedFilename;

    const imageNumber = Number(match[1]);
    const pairNumber = Math.ceil(imageNumber / 2);
    const topicNumber = pairNumber >= 3 && pairNumber <= 9
        ? pairNumber + 1
        : pairNumber === 10
            ? 3
            : pairNumber;
    const topic = `t${String(topicNumber).padStart(2, '0')}`;

    const postClass = String(post.class || '').toLowerCase();
    const condition = postClass.startsWith('c')
        ? 'con'
        : postClass.startsWith('l')
            ? 'lib'
            : (imageNumber % 2 === 1 ? 'con' : 'lib');
    const isAI = postClass.includes('ai');

    // These are reporting labels. They mirror the study-material convention
    // even though the web app stores all working copies as numbered JPGs.
    return `${topic}${condition}${isAI ? '-ai.png' : '-real'}`;
}

function getReadablePostReference(post) {
    const postID = post && post.postID != null ? post.postID : 'unknown';
    return `${getReadablePostImageName(post)} (PostID ${postID})`;
}

module.exports = {
    getReadablePostImageName,
    getReadablePostReference,
};
