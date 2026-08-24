"""Tests for email generator."""

from app.services.email_generator import normalize_custom, random_local_part


def test_random_local_part_shape():
    part = random_local_part()
    assert 5 <= len(part) <= 40
    assert part.replace("-", "").isalnum()


def test_random_local_part_unique_enough():
    a = {random_local_part() for _ in range(100)}
    assert len(a) >= 95  # collision rate is tiny but possible


def test_normalize_custom():
    assert normalize_custom("My_Tag 01!") == "mytag01"
    assert normalize_custom("Hello World") == "helloworld"