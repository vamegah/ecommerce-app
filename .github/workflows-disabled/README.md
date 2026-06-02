# Disabled GitHub Actions workflows

These workflows are kept for reference but are not active because GitHub only
loads workflow files from `.github/workflows`.

Move a file back into `.github/workflows` to re-enable it.

The PR preview workflows are disabled because they create or destroy AWS
resources and can be triggered by dependency PRs unless they are carefully
guarded.
