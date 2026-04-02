"""Logging helpers for the voice agent process."""

import logging
import sys


def configure_logging(level: int = logging.INFO) -> None:
    """Ensure the worker emits structured logs to stdout."""
    root = logging.getLogger()

    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter(
                fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
        )
        root.addHandler(handler)

    root.setLevel(level)
