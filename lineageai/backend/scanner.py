import os
from github import Github, GithubException

SKIP_DIRS = {"test", "tests", "vendor", "__pycache__", "migrations"}
ALLOWED_EXTENSIONS = {".sql", ".py"}


def _should_skip(path: str) -> bool:
    parts = path.split("/")
    return any(part in SKIP_DIRS for part in parts)


async def scan_repo(repo_url: str, token: str) -> list[dict]:
    """Walk a GitHub repo and return list of {path, content, extension} for .sql and .py files."""
    base_url = os.getenv("GITHUB_BASE_URL", "https://api.github.com")

    # Support GitHub Enterprise by passing a custom base_url
    if base_url == "https://api.github.com":
        gh = Github(token)
    else:
        gh = Github(base_url=base_url, login_or_token=token)

    # Extract "org/repo" from full URL
    repo_path = _parse_repo_path(repo_url)

    try:
        repo = gh.get_repo(repo_path)
    except GithubException as e:
        raise ValueError(f"Could not access repo '{repo_path}': {e.data.get('message', str(e))}")

    files = []
    _walk_tree(repo, "", files)
    return files


def _parse_repo_path(repo_url: str) -> str:
    """Extract 'org/repo' from a GitHub URL or return as-is if already that format."""
    url = repo_url.rstrip("/")
    # Handle full URLs like https://github.com/org/repo or https://github.example.com/org/repo
    if "://" in url:
        parts = url.split("/")
        if len(parts) >= 2:
            return f"{parts[-2]}/{parts[-1]}"
    return url


def _walk_tree(repo, path: str, files: list) -> None:
    """Recursively walk repo tree and collect matching files."""
    try:
        contents = repo.get_contents(path)
    except GithubException:
        return

    if not isinstance(contents, list):
        contents = [contents]

    for item in contents:
        if item.type == "dir":
            dir_name = item.path.split("/")[-1]
            if dir_name not in SKIP_DIRS:
                _walk_tree(repo, item.path, files)
        elif item.type == "file":
            if _should_skip(item.path):
                continue
            ext = _get_extension(item.name)
            if ext in ALLOWED_EXTENSIONS:
                try:
                    content = item.decoded_content.decode("utf-8", errors="replace")
                    files.append({"path": item.path, "content": content, "extension": ext})
                except Exception:
                    pass  # Skip undecodable files silently


def _get_extension(filename: str) -> str:
    _, ext = os.path.splitext(filename)
    return ext.lower()
