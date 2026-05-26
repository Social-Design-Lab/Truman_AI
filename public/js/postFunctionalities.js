function getCountTextNode(btn) {
    return btn.contents().filter(function () {
        return this.nodeType === 3; // text node
    }).get(0);
}

function getCount(btn) {
    const node = getCountTextNode(btn);
    if (!node) return { node: null, count: 0 };
    const count = parseInt(node.nodeValue.trim(), 10) || 0;
    return { node, count };
}

function setCount(btn, newCount) {
    const { node } = getCount(btn);
    if (node) node.nodeValue = ` ${newCount}`;
}

function withCsrf(payload) {
    const csrfToken = $('meta[name="csrf-token"]').attr('content');
    if (csrfToken) {
        return { ...payload, _csrf: csrfToken };
    }
    return payload;
}

function getActorFeedActionUrl() {
    const path = window.location.pathname.replace(/\/+$/, '');
    if (path === "/newsfeed/condition") {
        return `${window.location.pathname}${window.location.search}`;
    }
    return "/feed";
}

function postActorFeedAction(payload) {
    return $.post(getActorFeedActionUrl(), withCsrf(payload));
}

function toggleReaction(e, reactionType) {
    const btn = $(e.target).closest(`.ui.${reactionType}.button`);
    const card = btn.closest(".ui.fluid.card");

    const postID = card.attr("postID");
    const postClass = card.attr("postClass");
    const currDate = Date.now();

    const activeClass = "red";
    const oppositeType = reactionType === "like" ? "dislike" : "like";
    const oppositeBtn = card.find(`.ui.${oppositeType}.button`);

    let { count: currentCount } = getCount(btn);
    const isActive = btn.hasClass(activeClass);

    function postToServer(payload) {
        if (card.attr("type") === "userPost") {
            $.post("/userPost_feed", withCsrf({ postID, ...payload }));
        } else {
            postActorFeedAction({ postID, postClass, ...payload });
        }
    }

    if (isActive) {
        btn.removeClass(activeClass);
        currentCount -= 1;
        setCount(btn, currentCount);

        postToServer({ [`un${reactionType}`]: currDate });
        return;
    }

    if (oppositeBtn.length && oppositeBtn.hasClass(activeClass)) {
        oppositeBtn.removeClass(activeClass);
        let { count: oppositeCount } = getCount(oppositeBtn);
        oppositeCount -= 1;
        setCount(oppositeBtn, oppositeCount);

        postToServer({ [`un${oppositeType}`]: currDate });
    }

    btn.addClass(activeClass);
    currentCount += 1;
    setCount(btn, currentCount);

    postToServer({ [reactionType]: currDate });
}


function likePost(e) {
    const target = $(e.target).closest('.ui.like.button');
    const postID = target.closest(".ui.fluid.card").attr("postID");
    const postClass = target.closest(".ui.fluid.card").attr("postClass");
    const currDate = Date.now();
    console.log("test to see like inform: ", target);
    // Extract the current like count from the text node inside the button
    const likeTextNode = target.contents().filter(function() {
        return this.nodeType === 3; // Node.TEXT_NODE
    }).get(0);

    console.log("likeTextNode:", likeTextNode);
    let currentLikes = parseInt(likeTextNode.nodeValue.trim(), 10);

    if (target.hasClass("red")) { // Unlike Post
        target.removeClass("red");
        currentLikes -= 1;
        likeTextNode.nodeValue = ` ${currentLikes}`;

        if (target.closest(".ui.fluid.card").attr("type") == 'userPost') {
            $.post("/userPost_feed", withCsrf({
                postID: postID,
                unlike: currDate
            }));
        } else {
            postActorFeedAction({
                postID: postID,
                unlike: currDate,
                postClass: postClass
            });
        }
    } else { // Like Post
        target.addClass("red");
        currentLikes += 1;
        likeTextNode.nodeValue = ` ${currentLikes}`;

        if (target.closest(".ui.fluid.card").attr("type") == 'userPost') {
            $.post("/userPost_feed", withCsrf({
                postID: postID,
                like: currDate
            }));
        } else {
            postActorFeedAction({
                postID: postID,
                like: currDate,
                postClass: postClass
            });
        }
    }
}


function flagPost(e) {
    const target = $(e.target);
    const flagButton = target.closest('.ui.flag.button'); // Ensure we are targeting the button

    if (!flagButton.hasClass("red")) {
        const post = target.closest(".ui.fluid.card.dim");
        const postID = post.attr("postID");
        const postClass = post.attr("postClass");
        const share = Date.now();

        postActorFeedAction({
            postID: postID,
            share: share,
            postClass: postClass
        });

        const card = $(`.ui.fluid.card[postID='${postID}']`);
       
        // Find the flag button inside that card
        console.log("Flag button information: ", flagButton);

        // Ensure the flag button contains the correct text node
        const shareTextNode = flagButton.contents().filter(function() {
            return this.nodeType === 3 && this.nodeValue.trim() !== ""; // Node.TEXT_NODE and non-empty
        }).get(0);

        if (shareTextNode) {
            let currentSharesText = shareTextNode.nodeValue.trim();
            console.log("Current shares text:", currentSharesText);

            let currentShares = parseInt(currentSharesText, 10);
            if (!isNaN(currentShares)) {
                let newSharesNum = currentShares + 1; 
                // Update the share text node value
                shareTextNode.nodeValue = ` ${newSharesNum}`;
            } else {
                console.error("Current shares value is not a number:", currentSharesText);
            }
        } else {
            console.error("Share text node not found or contains only whitespace");
        }

        console.log("Share text node:", shareTextNode);
        flagButton.addClass("red"); // Add the class to the button
    } else {

        const post = target.closest(".ui.fluid.card.dim");
        const postID = post.attr("postID");
        const postClass = post.attr("postClass");
        const unshare = Date.now();

        postActorFeedAction({
            postID: postID,
            unshare: unshare,
            postClass: postClass
        });

        const card = $(`.ui.fluid.card[postID='${postID}']`);
       
        // Find the flag button inside that card
        console.log("Flag button information: ", flagButton);

        // Ensure the flag button contains the correct text node
        const shareTextNode = flagButton.contents().filter(function() {
            return this.nodeType === 3 && this.nodeValue.trim() !== ""; // Node.TEXT_NODE and non-empty
        }).get(0);

        if (shareTextNode) {
            let currentSharesText = shareTextNode.nodeValue.trim();
            console.log("Current shares text:", currentSharesText);

            let currentShares = parseInt(currentSharesText, 10);
            if (!isNaN(currentShares)) {
                let newSharesNum = currentShares - 1; 
                // Update the share text node value
                shareTextNode.nodeValue = ` ${newSharesNum}`;
            } else {
                console.error("Current shares value is not a number:", currentSharesText);
            }
        } else {
            console.error("Share text node not found or contains only whitespace");
        }

        console.log("Share text node:", shareTextNode);
        flagButton.removeClass("red"); // Add the class to the button
       
    }
}



function likeComment(e) {
    const target = $(e.target);
    const comment = target.parents(".comment");
    const label = comment.find("span.num");

    const postID = target.closest(".ui.fluid.card").attr("postID");
    const postClass = target.closest(".ui.fluid.card").attr("postClass");
    const commentID = comment.attr("commentID");
    const isUserComment = comment.find("a.author").attr('href') === '/me';
    const currDate = Date.now();

    if (target.hasClass("red")) { //Unlike comment
        target.removeClass("red");
        comment.find("i.heart.icon").removeClass("red");
        target.html('Like');
        label.html(function(i, val) { return val * 1 - 1 });

        if (target.closest(".ui.fluid.card").attr("type") == 'userPost') {
            $.post("/userPost_feed", withCsrf({
                postID: postID,
                commentID: commentID,
                unlike: currDate,
                isUserComment: isUserComment
            }));
        } else {
            postActorFeedAction({
                postID: postID,
                commentID: commentID,
                unlike: currDate,
                isUserComment: isUserComment,
                postClass: postClass
            });
        }
    } else { //Like comment
        target.addClass("red");
        comment.find("i.heart.icon").addClass("red");
        target.html('Unlike');
        label.html(function(i, val) { return val * 1 + 1 });

        if (target.closest(".ui.fluid.card").attr("type") == 'userPost')
            $.post("/userPost_feed", withCsrf({
                postID: postID,
                commentID: commentID,
                like: currDate,
                isUserComment: isUserComment
            }));
        else
            postActorFeedAction({
                postID: postID,
                commentID: commentID,
                like: currDate,
                isUserComment: isUserComment,
                postClass: postClass
            });
    }
}

function flagComment(e) {
    const target = $(e.target);
    const comment = target.parents(".comment");
    const postID = target.closest(".ui.fluid.card").attr("postID");
    const postClass = target.closest(".ui.fluid.card").attr("postClass");
    const commentID = comment.attr("commentID");
    comment.replaceWith(`
        <div class="comment" commentID="${commentID}" style="background-color:black;color:white">
            <h5 class="ui inverted header" style="padding-bottom: 0.5em; padding-left: 0.5em;">
                You have shared this post.
            </h5>
        </div>`);
    const flag = Date.now();

    if (target.closest(".ui.fluid.card").attr("type") == 'userPost')
        console.log("Should never be here.")
    else
        postActorFeedAction({
            postID: postID,
            commentID: commentID,
            flag: flag,
            postClass: postClass
        });
}

function addComment(e) {
    const target = $(e.target);
    const text = target.siblings(".ui.form").find("textarea.newcomment").val().trim();
    const card = target.parents(".ui.fluid.card");
    let comments = card.find(".ui.comments");
    const postClass = target.closest(".ui.fluid.card").attr("postClass");
    //no comments area - add it
    if (!comments.length) {
        const buttons = card.find(".ui.bottom.attached.icon.buttons")
        buttons.after('<div class="content"><div class="ui comments"></div>');
        comments = card.find(".ui.comments")
    }
    if (text.trim() !== '') {
        const currDate = Date.now();
        const ava = target.siblings('.ui.label').find('img.ui.avatar.image');
        const ava_img = ava.attr("src");
        const ava_name = ava.attr("name");
        const postID = card.attr("postID");
        const commentID = numComments + 1;

        const mess = `
        <div class="comment" commentID=${commentID}>
            <a class="avatar"><img src="${ava_img}"></a>
            <div class="content"> 
                <a class="author" href="/me">${ava_name}</a>
                <div class="metadata"> 
                    <span class="date">${humanized_time_span(currDate)}</span>
                    <i class="heart icon"></i> 
                    <span class="num"> 0 </span> Likes
                </div> 
                <div class="text">${text}</div>
                <div class="actions"> 
                    <a class="like comment" onClick="likeComment(event)">Like</a> 
                </div> 
            </div>
        </div>`;
        $(this).siblings(".ui.form").find("textarea.newcomment").val('');
        comments.append(mess);

        const newCommentCount = comments.children().length;
        //alert("comment length: " + newCommentCount); // Correct usage of alert
        updateCommentCount(postID, newCommentCount);

        if (card.attr("type") == 'userPost')
            $.post("/userPost_feed", withCsrf({
                postID: postID,
                new_comment: currDate,
                comment_text: text
            })).then(function(json) {
                numComments = json.numComments;
            });
        else
            postActorFeedAction({
                postID: postID,
                new_comment: currDate,
                comment_text: text,
                postClass: postClass
            }).then(function(json) {
                numComments = json.numComments;
            });
    }
}

function updateCommentCount(postID, newCommentCount) {
    // Find the card with the given postID
    const card = $(`.ui.fluid.card[postID='${postID}']`);
    // Find the reply button inside that card
    const replyButton = card.find('.ui.reply.button');
    // Find the text node containing the comment count
    const commentTextNode = replyButton.contents().filter(function() {
        return this.nodeType === 3; // Node.TEXT_NODE
    }).get(0);
    // Update the comment count
    if (commentTextNode) {
        commentTextNode.nodeValue = ` ${newCommentCount}`;
    } else {
        console.error("Comment text node not found");
    }
}

function followUser(e) {
    const target = $(e.target);
    const username = target.attr('actor_un');
    if (target.text().trim() == "Follow") { //Follow Actor
        $(`.ui.basic.primary.follow.button[actor_un='${username}']`).each(function(i, element) {
            const button = $(element);
            button.text("Following");
            button.prepend("<i class='check icon'></i>");
        })
        $.post("/user", {
            followed: username,
            _csrf: $('meta[name="csrf-token"]').attr('content')
        })
    } else { //Unfollow Actor
        $(`.ui.basic.primary.follow.button[actor_un='${username}']`).each(function(i, element) {
            const button = $(element);
            button.text("Follow");
            button.find('i').remove();
        })
        $.post("/user", {
            unfollowed: username,
            _csrf: $('meta[name="csrf-token"]').attr('content')
        })
    }
}

$(window).on('load', () => {
    //add humanized time to all posts
    $('.right.floated.time.meta, .date').each(function() {
        const ms = parseInt($(this).text(), 10);
        const time = new Date(ms);
        const humanizedTime = humanized_time_span(time);
        // Update the element's HTML while preserving the <strong> tag
        if ($(this).hasClass('actorPost')) {
            $(this).html('<strong style="color: black;">' + humanizedTime + '</strong>');
        } else {
            $(this).text(humanizedTime);
        }
    });

    // ************ Actions on Main Post ***************
    // Focus new comment element if "Reply" button is clicked
    $('.reply.button').on('click', function() {
        let parent = $(this).closest(".ui.fluid.card");
        parent.find("textarea.newcomment").focus();
    });

    // Press enter to submit a comment
    $("textarea.newcomment").keydown(function(event) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.stopImmediatePropagation();
            $(this).parents(".ui.form").siblings("i.big.send.link.icon").click();
        }
    });

    //Create a new Comment
    $("i.big.send.link.icon").on('click', addComment);

    //Like/Unlike Post //$('.like.button').on('click', likePost);
    $('.like.button').on('click', (e) => toggleReaction(e, 'like'));
    $('.dislike.button').on('click', (e) => toggleReaction(e, 'dislike'));

    //Flag Post
    $('.flag.button').on('click', flagPost);
    
    // ************ Actions on Comments***************
    // Like/Unlike comment
    $('a.like.comment').on('click', likeComment);

    //Flag comment
    $('a.flag.comment').on('click', flagComment);

    //Follow button
    $('.ui.basic.primary.follow.button').on('click', followUser);

    const viewStates = new Map();
    let viewCheckQueued = false;

    function imageFullyVisible(imageWrapper) {
        const rect = imageWrapper.getBoundingClientRect();
        return rect.height > 0 &&
            rect.width > 0 &&
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth;
    }

    function updateReadTimeDebug(card, message, totalViewTime, status) {
        const debugBox = card.find(".readtime-debug").first();
        if (!debugBox.length) return;

        debugBox.find(".readtime-status").text(message);
        if (totalViewTime === undefined) return;

        const values = debugBox.find(".readtime-values");
        const key = status === "confirmed" ? "data-confirmed-read-times" : "data-pending-read-times";
        let readTimes = [];
        try {
            readTimes = JSON.parse(values.attr(key) || "[]");
        } catch (err) {
            readTimes = [];
        }
        readTimes.push(Math.round(totalViewTime));
        values.attr(key, JSON.stringify(readTimes));

        const stored = JSON.parse(values.attr("data-read-times") || "[]");
        const confirmed = JSON.parse(values.attr("data-confirmed-read-times") || "[]");
        const pending = JSON.parse(values.attr("data-pending-read-times") || "[]");
        const parts = [
            `Stored on refresh: ${stored.length ? stored.join(", ") + " ms" : "none yet"}`
        ];
        if (confirmed.length) parts.push(`Saved this page: ${confirmed.join(", ")} ms`);
        if (pending.length) parts.push(`Sent, confirm after refresh: ${pending.join(", ")} ms`);
        values.text(parts.join(" | "));
    }

    function sendViewedTime(card, totalViewTime, useBeacon) {
        if (totalViewTime <= 1500 || totalViewTime >= 86400000) {
            updateReadTimeDebug(card, `Ignored ${Math.round(totalViewTime)} ms (outside save threshold)`);
            return;
        }

        updateReadTimeDebug(card, `Sending ${Math.round(totalViewTime)} ms`);

        const payload = withCsrf({
            postID: card.attr("postID"),
            viewed: Math.round(totalViewTime),
            postClass: card.attr("postClass")
        });

        if (useBeacon) {
            const body = new URLSearchParams(payload);
            const requestBody = body.toString();
            const contentType = "application/x-www-form-urlencoded;charset=UTF-8";

            if (navigator.sendBeacon) {
                const sent = navigator.sendBeacon(
                    getActorFeedActionUrl(),
                    new Blob([requestBody], { type: contentType })
                );
                if (sent) {
                    updateReadTimeDebug(card, `Sent ${Math.round(totalViewTime)} ms with sendBeacon; refresh to confirm`, totalViewTime, "pending");
                    return;
                }
            }

            if (window.fetch) {
                fetch(getActorFeedActionUrl(), {
                    method: "POST",
                    headers: { "Content-Type": contentType },
                    body: requestBody,
                    keepalive: true,
                    credentials: "same-origin"
                });
                updateReadTimeDebug(card, `Sent ${Math.round(totalViewTime)} ms with fetch keepalive; refresh to confirm`, totalViewTime, "pending");
                return;
            }
        }

        postActorFeedAction(payload)
            .done(function() {
                updateReadTimeDebug(card, `Saved ${Math.round(totalViewTime)} ms`, totalViewTime, "confirmed");
            })
            .fail(function(xhr, textStatus) {
                const detail = xhr && xhr.status ? `${xhr.status} ${xhr.responseText || textStatus}` : textStatus;
                updateReadTimeDebug(card, `Failed to save ${Math.round(totalViewTime)} ms (${detail})`);
            });
    }

    function stopPostTimer(imageWrapper, useBeacon) {
        const state = viewStates.get(imageWrapper);
        if (!state || !state.startTime) return;

        const totalViewTime = Date.now() - state.startTime;
        state.startTime = 0;
        $(imageWrapper).siblings(".content").children(".myTimer").text(0);
        sendViewedTime($(imageWrapper).parents(".ui.fluid.card"), totalViewTime, useBeacon);
    }

    function updatePostViewTimers() {
        viewCheckQueued = false;
        $('.ui.fluid.card .img.post').each(function() {
            const visible = document.visibilityState === "visible" && imageFullyVisible(this);
            let state = viewStates.get(this);

            if (!state) {
                state = { startTime: 0 };
                viewStates.set(this, state);
            }

            if (visible && !state.startTime) {
                state.startTime = Date.now();
                $(this).siblings(".content").children(".myTimer").text(state.startTime);
                updateReadTimeDebug($(this).parents(".ui.fluid.card"), "Timer started");
            } else if (!visible && state.startTime) {
                stopPostTimer(this, false);
            }
        });
    }

    function queuePostViewCheck() {
        if (viewCheckQueued) return;
        viewCheckQueued = true;
        window.requestAnimationFrame(updatePostViewTimers);
    }

    function flushPostViewTimers(useBeacon) {
        $('.ui.fluid.card .img.post').each(function() {
            stopPostTimer(this, useBeacon);
        });
    }

    queuePostViewCheck();
    $(window).on('scroll resize', queuePostViewCheck);
    $(window).on('focus pageshow', queuePostViewCheck);
    $(window).on('blur', function() {
        flushPostViewTimers(true);
    });
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === "hidden") {
            flushPostViewTimers(true);
        } else {
            queuePostViewCheck();
        }
    });
    window.addEventListener('pageshow', queuePostViewCheck);
    window.addEventListener('pagehide', function() {
        flushPostViewTimers(true);
    });
});
