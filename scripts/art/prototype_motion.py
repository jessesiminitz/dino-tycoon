"""Compatibility entry for the original three-animal prototype.

The full-roster author is now the single source of truth for editable clips.
"""
import runpy
from pathlib import Path

motion = runpy.run_path(str(Path(__file__).with_name('full_motion.py')), run_name='dino_motion')
globals().update({key:value for key,value in motion.items() if not key.startswith('__')})
