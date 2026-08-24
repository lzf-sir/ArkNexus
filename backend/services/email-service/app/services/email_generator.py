"""Random local-part generator for temporary mailboxes."""

from __future__ import annotations

import secrets
import string

ADJECTIVES = [
    "amber", "bold", "calm", "dapper", "eager", "fancy", "gentle", "happy",
    "icy", "jolly", "kind", "lively", "merry", "noble", "odd", "plucky",
    "quick", "rosy", "sunny", "tidy", "ultra", "vivid", "witty", "young",
    "zealous", "brave", "crisp", "dusty", "elastic", "frosty", "glossy",
    "humble", "infinite", "jade", "lucky", "misty", "neat", "opal",
    "peppy", "quiet", "ruby", "silent", "tough", "useful", "velvet",
    "whisper", "xenial", "yonder", "zippy",
]

NOUNS = [
    "tiger", "river", "mountain", "eagle", "phoenix", "dragon", "ocean",
    "forest", "comet", "star", "moon", "sun", "cloud", "storm", "breeze",
    "meadow", "valley", "harbor", "canyon", "prairie", "lagoon", "aurora",
    "ember", "falcon", "otter", "panther", "raven", "sparrow", "wolf",
    "maple", "cedar", "willow", "iris", "jasmine", "lotus", "rose",
    "thunder", "lightning", "rainbow", "meteor", "nebula", "galaxy",
    "marble", "crystal", "pearl", "diamond", "sapphire",
]


def _normalize(s: str) -> str:
    return "".join(ch for ch in s.lower() if ch.isalnum())


def random_local_part(max_len: int = 40) -> str:
    """Return something like `witty-comet-7k2p`."""
    adj = secrets.choice(ADJECTIVES)
    noun = secrets.choice(NOUNS)
    rand = "".join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(4))
    candidate = f"{_normalize(adj)}-{_normalize(noun)}-{rand}"
    return candidate[:max_len]


def normalize_custom(local_part: str) -> str:
    return _normalize(local_part)