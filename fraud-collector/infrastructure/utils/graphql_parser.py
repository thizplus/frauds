"""GraphQL Parser — Shape Detection + Tolerant Extractors

หลักการ:
- Shape detection: จัดประเภท response จาก structure ไม่ใช่ operation name
- Tolerant extractors: ลอง path หลายอัน ถ้าไม่เจอ log warning ไม่ crash
- Soft assertion: aggregate fallback/missing rate → schema drift alert
- Fallback path ไม่เกิน 3-5 ต่อ field

Usage:
    from infrastructure.utils.graphql_parser import (
        parse_stream_line, detect_response_shape, extract_post,
    )

    for line in read_jsonl("graphql_stream/chunk_0000.jsonl"):
        capture = json.loads(line)
        response = json.loads(capture["response_text"])
        for json_line in split_multiline(response):
            shape = detect_response_shape(json_line)
            if shape.type == "feed_post":
                post = extract_post(json_line, shape.node)
"""
import hashlib
import json
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger("graphql_parser")


# ============================================================
# safe_get — traverse nested dict/list by dot path
# ============================================================

def safe_get(obj, path, default=None):
    """Traverse nested dict/list by dot-separated path.

    Supports:
        "a.b.c"          → obj["a"]["b"]["c"]
        "a.b[0].c"       → obj["a"]["b"][0]["c"]
        "a[0][1].b"      → obj["a"][0][1]["b"]

    Returns default if any key is missing (never raises).
    """
    if not path:
        return obj if obj is not None else default

    # Tokenize: split by '.' but keep [N] as separate tokens
    tokens = []
    for part in path.split('.'):
        # "metadata[0]" → ["metadata", "[0]"]
        sub = re.split(r'(\[\d+\])', part)
        for s in sub:
            if s:
                tokens.append(s)

    current = obj
    for token in tokens:
        if current is None:
            return default
        if token.startswith('[') and token.endswith(']'):
            idx = int(token[1:-1])
            if isinstance(current, list) and len(current) > idx:
                current = current[idx]
            else:
                return default
        elif isinstance(current, dict):
            current = current.get(token)
        else:
            return default

    return current if current is not None else default


def has_path(obj, path) -> bool:
    """Check if path exists (value is not None)."""
    return safe_get(obj, path) is not None


# ============================================================
# Shape Detection — จัดประเภท response จาก structure
# ============================================================

@dataclass
class ResponseShape:
    type: str          # "feed_posts" | "story_node" | "comments" | "replies" | "unknown"
    nodes: list = field(default_factory=list)  # post/comment nodes found


def detect_response_shape(data: dict) -> ResponseShape:
    """Detect response type by structure, not operation name.

    FB เปลี่ยนชื่อ operation ได้ แต่ structure เปลี่ยนยากกว่า.
    """
    # Feed posts: data.node.group_feed.edges
    edges = safe_get(data, "data.node.group_feed.edges")
    if isinstance(edges, list) and edges:
        nodes = [e.get("node") for e in edges if isinstance(e, dict) and e.get("node")]
        return ResponseShape(type="feed_posts", nodes=nodes)

    # Single Story node: data.node.__typename == "Story"
    node = safe_get(data, "data.node")
    if isinstance(node, dict) and node.get("__typename") == "Story" and node.get("post_id"):
        return ResponseShape(type="story_node", nodes=[node])

    # Comments: has comment_rendering_instance with edges
    cri = safe_get(data, "data.node.comment_rendering_instance_for_feed_location.comments.edges")
    if isinstance(cri, list):
        return ResponseShape(type="comments", nodes=cri)

    # Replies: has replies_connection with edges
    replies = safe_get(data, "data.node.feedback.replies_connection.edges")
    if isinstance(replies, list):
        return ResponseShape(type="replies", nodes=replies)

    return ResponseShape(type="unknown")


def split_multiline_response(response_text: str) -> list[dict]:
    """FB ส่ง response เป็น multiline JSON (หลาย JSON objects ต่อบรรทัด).

    Return list of parsed JSON objects.
    """
    results = []
    for line in response_text.strip().split('\n'):
        line = line.strip()
        if not line:
            continue
        try:
            results.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return results


# ============================================================
# Extraction Metrics — track success/fallback/missing rates
# ============================================================

class ExtractionMetrics:
    """Track extraction success rates per field for schema drift detection."""

    def __init__(self):
        self.counts = {}

    def record(self, field_name: str, status: str):
        """status: 'primary' | 'fallback' | 'missing'"""
        key = f"{field_name}_{status}"
        self.counts[key] = self.counts.get(key, 0) + 1

    def get_rates(self, total_posts: int) -> dict:
        if total_posts == 0:
            return {}
        rates = {}
        for key, count in self.counts.items():
            rates[key + "_rate"] = round(count / total_posts, 3)
        return rates


# Global metrics instance (reset per extraction run)
metrics = ExtractionMetrics()


# ============================================================
# Tolerant Extractors — multi-path + soft assertion
# ============================================================

def _extract_field(node: dict, paths: list[tuple[str, str]], field_name: str, post_id: str = ""):
    """Generic extractor: try paths in order, log fallback/missing.

    paths: [("primary", "a.b.c"), ("fallback1", "x.y.z"), ...]
    """
    for label, path in paths:
        result = safe_get(node, path)
        if result is not None:
            if label != "primary":
                logger.warning(f"{field_name}_used_fallback", extra={
                    "post_id": post_id, "path_used": label,
                })
                metrics.record(field_name, "fallback")
            else:
                metrics.record(field_name, "primary")
            return result

    logger.warning(f"{field_name}_missing", extra={
        "post_id": post_id, "tried": [p for _, p in paths],
    })
    metrics.record(field_name, "missing")
    return None


def extract_message(node: dict, post_id: str = "") -> str | None:
    """Extract message text — รองรับทั้ง post ปกติ + shared post.

    Shared post: ข้อความจริงอยู่ใน attached_story (หลาย path ที่เป็นไปได้)
    Post ปกติ: ข้อความอยู่ใน comet_sections.content
    """
    # ลอง main post message ก่อน
    main_paths = [
        ("primary", "comet_sections.content.story.comet_sections.message_container.story.message.text"),
        ("fallback1", "message.text"),
    ]
    result = _extract_field(node, main_paths, "message", post_id)
    if result:
        return result

    # Shared post: ข้อความอยู่ใน attached_story (ลึกหลาย path)
    attached_paths = [
        ("attached_msg", "attached_story.comet_sections.message_container.story.message.text"),
        ("attached_layout", "attached_story.comet_sections.content.story.comet_sections.attached_story.story.attached_story.comet_sections.message_container.story.message.text"),
        ("attached_layout2", "attached_story.comet_sections.attached_story_layout.story.message.text"),
        ("attached_direct", "attached_story.message.text"),
    ]
    result = _extract_field(node, attached_paths, "message_attached", post_id)
    if result:
        return result

    # Last resort: recursive search หา message.text ที่ยาวที่สุดใน node
    best = _find_longest_message(node)
    if best:
        logger.warning("message_used_recursive_search", extra={"post_id": post_id, "length": len(best)})
        metrics.record("message", "fallback")
        return best

    metrics.record("message", "missing")
    return None


def _find_longest_message(obj, depth=0, max_depth=12) -> str | None:
    """Recursive search หา message.text ที่ยาวที่สุด (last resort)."""
    if depth > max_depth:
        return None
    best = None
    if isinstance(obj, dict):
        # หา dict ที่มี key "text" และ parent key คือ "message" หรือ "body"
        if "message" in obj and isinstance(obj["message"], dict):
            text = obj["message"].get("text")
            if text and isinstance(text, str) and len(text) > 5:
                if best is None or len(text) > len(best):
                    best = text
        for v in obj.values():
            child = _find_longest_message(v, depth + 1, max_depth)
            if child and (best is None or len(child) > len(best)):
                best = child
    elif isinstance(obj, list):
        for item in obj:
            child = _find_longest_message(item, depth + 1, max_depth)
            if child and (best is None or len(child) > len(best)):
                best = child
    return best


def extract_creation_time(node: dict, post_id: str = "") -> int | None:
    paths = [
        ("primary", "comet_sections.context_layout.story.comet_sections.metadata[0].story.creation_time"),
        ("fallback1", "comet_sections.timestamp.story.creation_time"),
        ("fallback2", "creation_time"),
    ]
    return _extract_field(node, paths, "creation_time", post_id)


def extract_author(node: dict, post_id: str = "") -> dict:
    actors = safe_get(node, "actors")
    if isinstance(actors, list) and actors:
        a = actors[0]
        return {
            "name": a.get("name", ""),
            "id": a.get("id", ""),
            "profile_url": a.get("profile_url") or a.get("url") or "",
        }

    # fallback: owning_profile
    op = safe_get(node, "feedback.owning_profile")
    if isinstance(op, dict):
        logger.warning("author_used_fallback", extra={"post_id": post_id, "path_used": "owning_profile"})
        metrics.record("author", "fallback")
        return {
            "name": op.get("name", ""),
            "id": op.get("id", ""),
            "profile_url": "",
        }

    metrics.record("author", "missing")
    return {"name": "", "id": "", "profile_url": ""}


def extract_engagement(node: dict, post_id: str = "") -> dict:
    """Extract reaction_count, top_reactions, share_count, comment_count."""
    result = {
        "reaction_count": 0,
        "reactions": {},
        "comment_count": 0,
        "share_count": 0,
    }

    # Deep search for counts in feedback sections
    def _search_feedback(obj, depth=0):
        if depth > 10 or not isinstance(obj, dict):
            return
        if "reaction_count" in obj and isinstance(obj["reaction_count"], dict):
            result["reaction_count"] = obj["reaction_count"].get("count", 0)
        if "share_count" in obj and isinstance(obj["share_count"], dict):
            result["share_count"] = obj["share_count"].get("count", 0)
        if "comment_rendering_instance" in obj:
            cri = obj["comment_rendering_instance"]
            if isinstance(cri, dict):
                c = cri.get("comments", {})
                if isinstance(c, dict):
                    result["comment_count"] = c.get("total_count", 0)
        if "top_reactions" in obj and isinstance(obj["top_reactions"], dict):
            for edge in obj["top_reactions"].get("edges", []):
                name = safe_get(edge, "node.localized_name")
                count = safe_get(edge, "i18n_reaction_count") or safe_get(edge, "reaction_count.count")
                if name and count:
                    result["reactions"][name.lower()] = int(count) if isinstance(count, (int, str)) and str(count).isdigit() else 0
        for v in obj.values():
            if isinstance(v, dict):
                _search_feedback(v, depth + 1)

    feedback = safe_get(node, "comet_sections.feedback")
    if feedback:
        _search_feedback(feedback)

    return result


def extract_images(node: dict, post_id: str = "") -> tuple[list[dict], int]:
    """Extract images from attachments — recursive search.

    Returns:
        (images, image_count_reported)
        - images: list of image dicts ที่ FB ส่งมา (อาจไม่ครบ)
        - image_count_reported: จำนวนรูปจริงที่ FB บอก (count field ใน all_subattachments)
          ถ้า image_count_reported > len(images) = FB ส่ง preview มาแค่บางส่วน
    """
    images = []
    reported_counts = []

    # Recursive: หา attachment nodes + count ทั่วทั้ง node tree
    _find_all_attachment_images(node, images, reported_counts, depth=0)

    # Dedup by URI
    seen = set()
    unique = []
    for img in images:
        key = img.get("thumbnail_url") or img.get("full_url")
        if key and key not in seen:
            seen.add(key)
            unique.append(img)

    # image_count_reported = max count ที่เจอ (FB อาจมีหลาย all_subattachments ซ้ำ)
    image_count_reported = max(reported_counts) if reported_counts else len(unique)

    return unique, image_count_reported


def _find_all_attachment_images(obj, images: list, reported_counts: list, depth: int = 0, max_depth: int = 15):
    """Recursive search หา images จาก attachments ทุก level ของ tree.

    หา 2 patterns:
    1. all_subattachments.nodes[].media (album) — เก็บ count ด้วย
    2. styles.attachment.media ที่มี photo_image (single photo)
    """
    if depth > max_depth or not isinstance(obj, dict):
        return

    # Pattern 1: พบ all_subattachments → ดึง images จาก nodes + เก็บ count
    sa = obj.get("all_subattachments")
    if isinstance(sa, dict):
        count = sa.get("count", 0)
        nodes = sa.get("nodes", [])
        if count > 0:
            reported_counts.append(count)
        if isinstance(nodes, list) and nodes:
            for sub in nodes:
                media = sub.get("media", {})
                if isinstance(media, dict):
                    img = _parse_media(media)
                    if img:
                        images.append(img)
            return  # พบ album แล้ว ไม่ต้อง search ลึกกว่านี้ใน branch นี้

    # Pattern 2: พบ media ที่มี photo_image (single photo)
    if "photo_image" in obj and isinstance(obj.get("photo_image"), dict):
        img = _parse_media(obj)
        if img:
            images.append(img)
            reported_counts.append(1)
            return

    # Recurse deeper
    for key, val in obj.items():
        if key in ("feedback", "actor", "actors", "owning_profile", "author",
                    "comment_action_links", "tracking", "extensions"):
            continue  # skip branches ที่ไม่มี images
        if isinstance(val, dict):
            _find_all_attachment_images(val, images, reported_counts, depth + 1, max_depth)
        elif isinstance(val, list):
            for item in val:
                if isinstance(item, dict):
                    _find_all_attachment_images(item, images, reported_counts, depth + 1, max_depth)


def _extract_images_from_attachment(att: dict) -> list[dict]:
    """Extract images from a single attachment node (handles both album and single)."""
    images = []
    if not isinstance(att, dict):
        return images

    styles = att.get("styles", {})
    if not isinstance(styles, dict):
        return images

    style_att = styles.get("attachment", {})
    if not isinstance(style_att, dict):
        return images

    # Pattern 1: Album — all_subattachments.nodes[].media
    subs = safe_get(style_att, "all_subattachments.nodes")
    if isinstance(subs, list) and subs:
        for sub in subs:
            media = sub.get("media", {})
            if isinstance(media, dict):
                img = _parse_media(media)
                if img:
                    images.append(img)
        return images

    # Pattern 2: Single photo — styles.attachment.media
    media = style_att.get("media", {})
    if isinstance(media, dict):
        img = _parse_media(media)
        if img:
            images.append(img)

    return images


def _parse_media(media: dict) -> dict | None:
    """Parse a Photo media node into image dict.

    FB ใช้หลาย field สำหรับ image URL:
    - image.uri          (subattachments — thumbnail ~590px)
    - viewer_image.uri   (subattachments — full resolution)
    - photo_image.uri    (single photo — medium resolution)
    - massive_image.uri  (comments — full resolution)
    """
    if not isinstance(media, dict):
        return None
    typename = media.get("__typename", "")
    if typename and typename not in ("Photo",):
        return None  # skip Video, Sticker, etc.

    # Collect all possible URIs
    image = media.get("image", {}) or {}
    viewer = media.get("viewer_image", {}) or {}
    photo = media.get("photo_image", {}) or {}
    massive = media.get("massive_image", {}) or {}

    # Thumbnail: image.uri > photo_image.uri
    thumbnail_url = ""
    if isinstance(image, dict) and image.get("uri"):
        thumbnail_url = image["uri"]
    elif isinstance(photo, dict) and photo.get("uri"):
        thumbnail_url = photo["uri"]

    # Full resolution: viewer_image.uri > massive_image.uri > photo_image.uri > image.uri
    full_url = ""
    for source in [viewer, massive, photo, image]:
        if isinstance(source, dict) and source.get("uri"):
            full_url = source["uri"]
            break

    if not thumbnail_url and not full_url:
        return None

    # Best size info
    best_size = viewer or massive or photo or image or {}

    return {
        "thumbnail_url": thumbnail_url or full_url,
        "full_url": full_url or thumbnail_url,
        "width": best_size.get("width", 0) if isinstance(best_size, dict) else 0,
        "height": best_size.get("height", 0) if isinstance(best_size, dict) else 0,
        "accessibility_caption": media.get("accessibility_caption", ""),
    }


def extract_attached_story(node: dict, post_id: str = "") -> dict | None:
    """Extract attached_story (shared post)."""
    att = node.get("attached_story")
    if not isinstance(att, dict):
        return None

    # Message ของ attached_story อยู่ได้หลาย path
    att_msg = None
    att_msg_paths = [
        "comet_sections.message_container.story.message.text",
        "comet_sections.attached_story_layout.story.message.text",
        "comet_sections.content.story.comet_sections.attached_story.story.attached_story.comet_sections.message_container.story.message.text",
        "message.text",
    ]
    for p in att_msg_paths:
        att_msg = safe_get(att, p)
        if att_msg:
            break
    if not att_msg:
        att_msg = _find_longest_message(att) or ""

    att_images, att_image_count = extract_images(att, post_id=f"{post_id}_attached")
    return {
        "post_id": att.get("post_id", ""),
        "permalink_url": att.get("permalink_url", ""),
        "author": extract_author(att, post_id=f"{post_id}_attached"),
        "message": att_msg,
        "creation_time": safe_get(att, "comet_sections.context_layout.story.comet_sections.metadata[0].story.creation_time"),
        "images": att_images,
        "image_count_reported": att_image_count,
    }


def extract_initial_comments(node: dict, post_id: str = "") -> list[dict]:
    """Extract interesting_top_level_comments from feed response."""
    comments = []

    # Path: feedback...interesting_top_level_comments
    def _find_interesting(obj, depth=0):
        if depth > 10:
            return
        if isinstance(obj, dict):
            if "interesting_top_level_comments" in obj:
                for item in obj["interesting_top_level_comments"]:
                    c = item.get("comment", {})
                    if not isinstance(c, dict):
                        continue
                    comments.append(_parse_comment_node(c))
            for v in obj.values():
                _find_interesting(v, depth + 1)

    _find_interesting(node)
    return comments


def _parse_comment_node(c: dict) -> dict:
    """Parse a comment node (from GraphQL) into flat comment dict."""
    created_time = None
    for link in c.get("comment_action_links", []):
        if isinstance(link, dict):
            ct = safe_get(link, "comment.created_time")
            if ct:
                created_time = ct
                break
    if not created_time:
        created_time = c.get("created_time")

    return {
        "comment_id": c.get("legacy_fbid") or c.get("id") or None,
        "parent_comment_id": None,
        "depth": c.get("depth", 0),
        "author": {
            "name": safe_get(c, "author.name") or "",
            "id": safe_get(c, "author.id") or "",
        },
        "text": safe_get(c, "body.text") or "",
        "created_time": created_time,
        "attachments": _parse_comment_attachments(c),
        "source": ["graphql"],
    }


def _parse_comment_attachments(c: dict) -> list[dict]:
    """Parse attachments from a comment node."""
    results = []
    for att in c.get("attachments", []):
        if not isinstance(att, dict):
            continue
        media = safe_get(att, "style_type_renderer.attachment.media") or att.get("media", {})
        if not isinstance(media, dict):
            continue
        img = media.get("image", {})
        massive = media.get("massive_image", {})
        if not isinstance(img, dict):
            continue
        if img.get("uri"):
            results.append({
                "type": media.get("__typename", "Photo"),
                "thumbnail_url": img.get("uri", ""),
                "full_url": (massive or img).get("uri", "") if isinstance(massive, dict) else img.get("uri", ""),
                "accessibility_caption": media.get("accessibility_caption", ""),
            })
    return results


# ============================================================
# Comment Batch Parsing (จาก GraphQL comment/reply responses)
# ============================================================

def parse_comment_batch(data: dict) -> list[dict]:
    """Parse GraphQL comment batch response → flat comment list.

    รองรับ:
    - comment_rendering_instance_for_feed_location.comments.edges
    - feedback.replies_connection.edges
    - recursive nested structure

    Returns flat list with parent_comment_id + depth.
    """
    comments = []

    # Recursive search หา comment edges ทั่วทั้ง response
    _find_comment_edges(data, comments)

    return comments


def _find_comment_edges(obj, comments: list, depth: int = 0, max_depth: int = 15):
    """Recursive search หา comment/reply edges."""
    if depth > max_depth or not isinstance(obj, dict):
        return

    # Pattern 1: comments.edges (top-level comments)
    for key in ("comments", "display_comments"):
        container = obj.get(key)
        if isinstance(container, dict) and "edges" in container:
            for edge in container.get("edges", []):
                comment_data = edge.get("comment") or edge.get("node")
                if not isinstance(comment_data, dict):
                    continue
                # ต้องมี legacy_fbid (เป็น comment จริง ไม่ใช่ noise)
                if not comment_data.get("legacy_fbid") and not comment_data.get("id"):
                    continue
                # รับทั้ง text comments และ image-only comments (body=null + มี attachments)
                has_body = bool(safe_get(comment_data, "body.text"))
                has_att = bool(comment_data.get("attachments"))
                if not has_body and not has_att:
                    continue

                parsed = _parse_comment_node(comment_data)
                comments.append(parsed)

                # Parse replies ของ comment นี้
                _extract_replies(comment_data, parsed["comment_id"], comments)

    # Pattern 2: replies_connection.edges (reply batch response)
    rc = obj.get("replies_connection")
    if isinstance(rc, dict) and "edges" in rc:
        parent_id = obj.get("legacy_fbid") or obj.get("id")
        for edge in rc.get("edges", []):
            reply_data = edge.get("node")
            if not isinstance(reply_data, dict):
                continue
            has_body = bool(safe_get(reply_data, "body.text"))
            has_att = bool(reply_data.get("attachments"))
            if not has_body and not has_att:
                continue

            parsed = _parse_comment_node(reply_data)
            parsed["parent_comment_id"] = parent_id
            parsed["depth"] = max(parsed["depth"], 1)
            comments.append(parsed)

    # Recurse deeper
    for key, val in obj.items():
        if key in ("edges", "nodes", "comments", "display_comments", "replies_connection"):
            continue  # already handled
        if isinstance(val, dict):
            _find_comment_edges(val, comments, depth + 1, max_depth)
        elif isinstance(val, list):
            for item in val:
                if isinstance(item, dict):
                    _find_comment_edges(item, comments, depth + 1, max_depth)


def _extract_replies(comment_data: dict, parent_id: str | None, comments: list):
    """Extract replies from a comment node's feedback.replies_connection."""
    rc = safe_get(comment_data, "feedback.replies_connection")
    if not isinstance(rc, dict):
        return

    for edge in rc.get("edges", []):
        reply_data = edge.get("node")
        if not isinstance(reply_data, dict):
            continue
        has_body = bool(safe_get(reply_data, "body.text"))
        has_att = bool(reply_data.get("attachments"))
        if not has_body and not has_att:
            continue

        parsed = _parse_comment_node(reply_data)
        parsed["parent_comment_id"] = parent_id
        parsed["depth"] = max(parsed["depth"], 1)
        comments.append(parsed)


# ============================================================
# HTML Comment Extraction (จาก initial page render)
# ============================================================

def extract_comments_from_html(html_content: str) -> list[dict]:
    """Parse comments จาก HTML snapshot (role='article' elements).

    FB render comments แรกๆ ใน HTML ตั้งแต่แรก ไม่ผ่าน GraphQL.
    ใช้ text parsing — ไม่ใช่ DOM parser (เพราะ snapshot เป็น outerHTML fragments).

    Returns flat comment list with source=["html"].
    """
    import re as _re

    comments = []

    # Split by role="article" boundaries
    articles = _re.split(r'<div[^>]*role="article"[^>]*>', html_content)

    for article_html in articles[1:]:  # skip first (before first article)
        # Extract text content (strip HTML tags)
        text_content = _re.sub(r'<[^>]+>', '\n', article_html)
        text_content = _re.sub(r'\n+', '\n', text_content).strip()

        lines = [l.strip() for l in text_content.split('\n') if l.strip()]
        if len(lines) < 2:
            continue

        # First line = author name
        author = lines[0]

        # Skip non-comment articles
        if author in ('Like', 'Comment', 'Share', 'ถูกใจ', 'แสดงความคิดเห็น', 'แชร์'):
            continue

        # Body = everything after author, minus action buttons
        skip_words = {
            'like', 'reply', 'share', 'edited', 'follow', 'ถูกใจ', 'ตอบกลับ',
            'แชร์', 'แก้ไขแล้ว', 'ติดตาม', 'most relevant', 'all comments',
            'hidden by facebook', 'ความคิดเห็นทั้งหมด',
            'verified account', 'top fan', 'author', 'admin', 'moderator',
            '&nbsp;', '\xa0',
        }
        body_lines = []
        for line in lines[1:]:
            low = line.lower()
            if low in skip_words:
                continue
            if _re.match(r'^\d+[hmdw]$', low) or _re.match(r'^\d+\s*[hmdw]$', low):
                continue  # "2h", "3d", "1w", "4 w"
            if _re.match(r'^\d+ (hour|min|day|week)', low):
                continue
            if _re.match(r'^view \d+ repl', low) or _re.match(r'^view all \d+ repl', low):
                continue
            if _re.match(r'^ดู \d+ การตอบกลับ', low):
                continue
            if _re.match(r'^\d+$', low):
                continue  # reaction counts
            if len(line) <= 1:
                continue
            body_lines.append(line)

        body = '\n'.join(body_lines).strip()

        # Extract images — หา <img src="scontent..."> ที่ไม่ใช่ profile pic
        # Profile pic ใช้ s40x40, s34x34, s50x50, p40x40 — skip เฉพาะเหล่านี้
        img_urls = _re.findall(r'<img[^>]*src="(https://scontent[^"]+)"', article_html)
        content_imgs = [u for u in img_urls if not _re.search(r'[sp](40x40|34x34|50x50|36x36)', u)]

        has_img = len(content_imgs) > 0

        # รับทั้ง text comments และ image-only (body ว่างแต่มีรูป)
        if len(body) < 3 and not has_img:
            continue

        attachments = []
        for img_url in content_imgs:
            attachments.append({
                "type": "Photo",
                "thumbnail_url": img_url,
                "full_url": img_url,
                "accessibility_caption": "",
                "source": "html",
            })

        comments.append({
            "comment_id": None,
            "parent_comment_id": None,
            "depth": 0,
            "author": {"name": author[:100], "id": ""},
            "text": body[:500],
            "created_time": None,
            "attachments": attachments,
            "source": ["html"],
        })

    return comments


# ============================================================
# Merge Comments (GraphQL + HTML → dedup)
# ============================================================

def merge_comments(
    graphql_comments: list[dict],
    html_comments: list[dict],
    initial_comments: list[dict] | None = None,
    top_level_only: bool = True,
) -> list[dict]:
    """Merge comments จากทุก source → dedup → flat list.

    Args:
        top_level_only: ถ้า True → เก็บเฉพาะ depth=0 (top-level)
                        ข้าม replies (depth > 0) เพื่อความเร็ว + coverage สูงขึ้น
    """
    import hashlib

    merged = {}  # key → comment dict

    def _normalize(text: str) -> str:
        """Normalize text สำหรับ dedup — unicode normalize + whitespace collapse"""
        import re as _r
        import unicodedata
        t = text or ""
        t = t.replace('\xa0', ' ')         # &nbsp;
        t = t.replace('&nbsp;', ' ')
        t = unicodedata.normalize('NFKC', t)  # unicode normalize (ไทย spacing)
        t = _r.sub(r'\s+', ' ', t)         # collapse whitespace
        t = t.strip().lower()
        return t[:120]                     # ใช้ 120 chars (มากกว่า 40 — จับ text ยาวกว่า)

    def _key(c):
        """Generate dedup key — priority: ID → author_id+text → author_name+text+timestamp"""
        cid = c.get("comment_id")
        if cid:
            return f"id:{cid}"

        text = _normalize(c.get("text", ""))
        author_id = c.get("author", {}).get("id", "")
        author_name = (c.get("author", {}).get("name", "") or "").strip()

        # Priority 2: author_id + text (ถ้ามี author_id)
        if author_id:
            return f"hash:{hashlib.sha1(f'{author_id}|{text}'.encode()).hexdigest()}"

        # Priority 3: author_name + text + timestamp
        # ต้องใช้ author_name สำหรับ HTML comments ที่ไม่มี ID
        # โดยเฉพาะ image-only (text="") ต้องมี author_name แยก
        ts = c.get("created_time")
        ts_bucket = int(ts / 60) if ts else 0
        return f"hash:{hashlib.sha1(f'{author_name}|{text}|{ts_bucket}'.encode()).hexdigest()}"

    # สร้าง text index สำหรับ cross-check (HTML ไม่มี ID แต่ GraphQL มี)
    def _text_key(c):
        """Normalize text key สำหรับ cross-check ระหว่าง HTML กับ GraphQL"""
        text = _normalize(c.get("text", ""))
        author = (c.get("author", {}).get("name", "") or "").strip()[:30]
        return f"{author}|{text}"

    # HTML comments ก่อน (แสดงบนสุดใน FB — initial render)
    text_index = {}  # text_key → merged dict key
    for c in html_comments:
        key = _key(c)
        if key not in merged:
            merged[key] = c
            tk = _text_key(c)
            text_index[tk] = key

    # แล้ว GraphQL comments ต่อ (higher quality — has ID + timestamp)
    all_sources = []
    if initial_comments:
        all_sources.extend(initial_comments)
    all_sources.extend(graphql_comments)

    for c in all_sources:
        key = _key(c)

        # Cross-check: GraphQL มี ID แต่ HTML ไม่มี → ลอง match ด้วย text
        existing_key = None
        if key not in merged:
            tk = _text_key(c)
            if tk in text_index:
                existing_key = text_index[tk]  # match กับ HTML ด้วย text
        else:
            existing_key = key

        if existing_key and existing_key in merged:
            # Enrich existing (HTML) ด้วย GraphQL data
            existing = merged[existing_key]
            if c.get("comment_id") and not existing.get("comment_id"):
                existing["comment_id"] = c["comment_id"]
            if c.get("created_time") and not existing.get("created_time"):
                existing["created_time"] = c["created_time"]
            if c.get("text") and not existing.get("text"):
                existing["text"] = c["text"]
            # Merge attachments ถ้า GraphQL มีดีกว่า
            if c.get("attachments") and not existing.get("attachments"):
                existing["attachments"] = c["attachments"]
            existing_sources = existing.get("source", [])
            for s in c.get("source", []):
                if s not in existing_sources:
                    existing_sources.append(s)
            existing["source"] = existing_sources
        else:
            # ไม่ match HTML → เพิ่มใหม่
            merged[key] = c

    result = list(merged.values())

    # Filter top-level only
    if top_level_only:
        result = [c for c in result if c.get("depth", 0) == 0]

    return result


# ============================================================
# High-level: Extract full post from a Story node
# ============================================================

def extract_post(node: dict) -> dict:
    """Extract all data from a Story node → extracted.json format."""
    post_id = node.get("post_id", "")
    images, image_count_reported = extract_images(node, post_id)

    return {
        "post_id": post_id,
        "permalink_url": node.get("permalink_url", ""),
        "group_id": safe_get(node, "feedback.associated_group.id")
                    or safe_get(node, "to.id") or "",
        "author": extract_author(node, post_id),
        "message": extract_message(node, post_id),
        "creation_time": extract_creation_time(node, post_id),
        "images": images,
        "image_count_reported": image_count_reported,
        "engagement": extract_engagement(node, post_id),
        "initial_comments": extract_initial_comments(node, post_id),
        "attached_story": extract_attached_story(node, post_id),
        "fingerprint": post_id,
    }


# ============================================================
# Fingerprint
# ============================================================

def compute_fingerprint(post_id: str, author_id: str = "", message: str = "", creation_time: int | None = None) -> str:
    """Primary: post_id. Fallback: sha1(author_id + message[:300] + rounded_timestamp)."""
    if post_id:
        return post_id
    raw = f"{author_id}:{(message or '')[:300]}:{creation_time or 0}"
    return hashlib.sha1(raw.encode('utf-8')).hexdigest()
