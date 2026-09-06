"""Shared helpers for route modules."""


def _escape_like(term: str) -> str:
    """Escape LIKE wildcards so user input can't inject %/_ patterns."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
