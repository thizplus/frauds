"""JS scripts ที่รันใน browser — แยกไฟล์เพื่อ maintain ง่าย"""

# กด "ดูเพิ่มเติม" / "See more"
JS_EXPAND = """
document.querySelectorAll('div[role="button"]').forEach(function(el) {
    var t = (el.innerText || '').trim();
    if (t === 'ดูเพิ่มเติม' || t === 'See more' || t === 'เพิ่มเติม') el.click();
});
"""

# Extract โพสต์ทั้งหมด — เก็บ raw ครบทุก field
JS_EXTRACT = """
var posts = [];
var profileNames = document.querySelectorAll('[data-ad-rendering-role="profile_name"]');

for (var i = 0; i < profileNames.length; i++) {
    var nameEl = profileNames[i];
    var name = (nameEl.innerText || '').split('\\n')[0].trim();
    if (!name) continue;

    // หา container ที่มี story_message
    var container = null;
    var p = nameEl;
    for (var d = 0; d < 15; d++) {
        p = p.parentElement;
        if (!p || p.tagName === 'BODY') break;
        if (p.querySelector('[data-ad-rendering-role="story_message"]')) {
            container = p;
            break;
        }
    }
    if (!container) continue;
    if (container.dataset.scraped === '1') continue;
    container.dataset.scraped = '1';

    // === TEXT จากหลาย source ===
    var textSources = {};

    // source 1: story_message (หลัก)
    var msgEl = container.querySelector('[data-ad-rendering-role="story_message"]');
    if (msgEl) textSources.story_message = (msgEl.innerText || '').trim();

    // source 2: data-ad-preview="message"
    var previewEl = container.querySelector('[data-ad-preview="message"]');
    if (previewEl) textSources.preview_message = (previewEl.innerText || '').trim();

    // source 3: dir="auto" spans (fallback)
    var autoSpans = container.querySelectorAll('[dir="auto"]');
    var autoTexts = [];
    for (var s = 0; s < autoSpans.length && s < 5; s++) {
        var st = (autoSpans[s].innerText || '').trim();
        if (st.length > 10) autoTexts.push(st.substring(0, 200));
    }
    if (autoTexts.length > 0) textSources.auto_spans = autoTexts;

    // === AUTHOR ===
    var profileUrl = '';
    var profileLinks = container.querySelectorAll('a[href*="/user/"]');
    if (profileLinks.length > 0) profileUrl = (profileLinks[0].href || '').split('?')[0];

    // === PERMALINK (ตัด comment_id) ===
    var postId = '';
    var permalink = '';
    var allLinks = container.querySelectorAll('a[href]');
    for (var k = 0; k < allLinks.length; k++) {
        var href = allLinks[k].href || '';
        if (href.indexOf('/posts/') > -1 || href.indexOf('/permalink/') > -1) {
            // extract post ID จาก URL
            var match = href.match(/\\/posts\\/(\\d+)/);
            if (match) {
                postId = match[1];
                permalink = href.split('?')[0];
                // ถ้ามี comment_id ให้ตัดออก สร้าง permalink ใหม่
                if (permalink.indexOf('comment_id') > -1) {
                    permalink = permalink.split('?')[0];
                }
                break;
            }
        }
    }

    // === TIMESTAMP ===
    var timestampText = '';
    var timestampUnix = null;
    // หา abbr ที่มี data-utime (unix timestamp)
    var abbrEls = container.querySelectorAll('abbr[data-utime]');
    if (abbrEls.length > 0) {
        timestampUnix = parseInt(abbrEls[0].getAttribute('data-utime'));
        timestampText = (abbrEls[0].innerText || '').trim();
    }
    // fallback: หา timestamp จาก link text (เช่น "2h", "3d")
    if (!timestampText) {
        for (var t = 0; t < allLinks.length; t++) {
            var lt = (allLinks[t].innerText || '').trim();
            if (/^\\d+[hmdw]$/.test(lt) || /^\\d+ (hour|min|day|week)/.test(lt)) {
                timestampText = lt;
                break;
            }
        }
    }

    // === IMAGES ===
    var imgs = [];
    var imgEls = container.querySelectorAll('img[src*="scontent"]');
    for (var j = 0; j < imgEls.length; j++) {
        var img = imgEls[j];
        var nw = img.naturalWidth || img.width || 0;
        var nh = img.naturalHeight || img.height || 0;
        if (nw > 150 && nh > 150 && img.complete) {
            imgs.push({
                src: img.src,
                width: nw,
                height: nh,
                alt: (img.alt || '').substring(0, 200)
            });
        }
    }

    // === TOP-LEVEL COMMENTS (20 อันแรก) ===
    var comments = [];
    var commentArticles = container.querySelectorAll('[role="article"]');
    for (var c = 0; c < commentArticles.length && comments.length < 20; c++) {
        var cText = (commentArticles[c].innerText || '').trim();
        if (cText.length < 5) continue;
        // comment มี "Reply" ไม่มี "Comment" button
        if (cText.indexOf('Reply') > -1) {
            // extract ชื่อ + text จาก comment
            var cLines = cText.split('\\n');
            var cAuthor = cLines[0] || '';
            var cBody = cLines.slice(1).join(' ')
                .replace(/Like/g, '').replace(/Reply/g, '').replace(/Share/g, '')
                .replace(/\\d+[hmdw]/g, '').replace(/Edited/g, '').trim();
            if (cBody.length > 3) {
                comments.push({
                    author: cAuthor.substring(0, 100),
                    text: cBody.substring(0, 500)
                });
            }
        }
    }

    // === ALL ROLES (debug) ===
    var roles = [];
    container.querySelectorAll('[data-ad-rendering-role]').forEach(function(el) {
        var r = el.getAttribute('data-ad-rendering-role');
        if (roles.indexOf(r) === -1) roles.push(r);
    });

    posts.push({
        post_id: postId,
        permalink: permalink,
        author: {
            name: name,
            profile_url: profileUrl
        },
        text_sources: textSources,
        images: imgs,
        comments: comments,
        timestamp_text: timestampText,
        timestamp_unix: timestampUnix,
        roles: roles
    });
}
return JSON.stringify(posts);
"""

# DOM snapshot — ดูว่า JS เห็นอะไรทั้งหมด
JS_DOM_SNAPSHOT = """
var data = {};
data.url = location.href;
data.articles = document.querySelectorAll('[role="article"]').length;
data.profileNames = [];
document.querySelectorAll('[data-ad-rendering-role="profile_name"]').forEach(function(el) {
    data.profileNames.push(el.innerText.split('\\n')[0].trim());
});
data.storyMessages = [];
document.querySelectorAll('[data-ad-rendering-role="story_message"]').forEach(function(el) {
    data.storyMessages.push((el.innerText || '').substring(0, 200));
});
data.allImages = [];
document.querySelectorAll('img[src*="scontent"]').forEach(function(img) {
    data.allImages.push({
        src: img.src.substring(0, 120),
        w: img.naturalWidth || img.width,
        h: img.naturalHeight || img.height,
        complete: img.complete
    });
});
data.allRoles = [];
document.querySelectorAll('[data-ad-rendering-role]').forEach(function(el) {
    data.allRoles.push({
        role: el.getAttribute('data-ad-rendering-role'),
        text: (el.innerText || '').substring(0, 80)
    });
});
return JSON.stringify(data);
"""
