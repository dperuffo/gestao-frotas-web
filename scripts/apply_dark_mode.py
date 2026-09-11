#!/usr/bin/env python3
import re
import sys

MAPPINGS = [
    ("bg-white", "bg-slate-800"),
    ("bg-slate-50", "bg-slate-800/50"),
    ("bg-slate-100", "bg-slate-700"),
    ("text-slate-900", "text-slate-100"),
    ("text-slate-800", "text-slate-100"),
    ("text-slate-700", "text-slate-300"),
    ("text-slate-600", "text-slate-300"),
    ("text-slate-500", "text-slate-400"),
    ("border-slate-200", "border-slate-700"),
    ("border-slate-100", "border-slate-700"),
    ("divide-slate-100", "divide-slate-700"),
    ("divide-slate-200", "divide-slate-700"),
]


def build_pattern(cls, target):
    escaped = re.escape(cls)
    esc_target = re.escape(target)
    return re.compile(
        r'(?<=["\'\s`])' + escaped + r'(?![\w/-])(?! dark:' + esc_target + r')'
    )


def process(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    original = content
    total_subs = 0
    for cls, target in MAPPINGS:
        pattern = build_pattern(cls, target)
        replacement = cls + " dark:" + target
        content, n = pattern.subn(replacement, content)
        total_subs += n
    if content != original:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
    return total_subs


def main():
    files = sys.argv[1:]
    grand_total = 0
    changed_files = 0
    for path in files:
        try:
            n = process(path)
        except Exception as e:
            print(f"ERROR {path}: {e}")
            continue
        if n:
            changed_files += 1
            grand_total += n
            print(f"{n}\t{path}")
    print(f"---\nfiles_changed={changed_files} total_substitutions={grand_total}")


if __name__ == "__main__":
    main()
