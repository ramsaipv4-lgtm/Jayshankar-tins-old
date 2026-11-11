#!/usr/bin/env bash
# Publish a review deck to its own GitHub Pages repository.
#
# There are THREE decks (see docs/REVIEW-BUILD.md §8–§10): deck 1 draws the chapters in the app's own
# Tailwind look, deck 2 draws the identical chapters in Ant Design, and deck 3 ("The Run") draws the same
# chapters and persona walks in a third look. They share one data set and one address format, so the
# client compares looks by opening the links — or all three side by side on deck 3's Compare page.
#
#   DECK=storybook      bash scripts/publish-storybook.sh   # deck 1 (Tailwind) — the default
#   DECK=storybook-ant  bash scripts/publish-storybook.sh   # deck 2 (Ant Design 6)
#   DECK=storybook-run  bash scripts/publish-storybook.sh   # deck 3 ("The Run" — see docs/REVIEW-BUILD.md §9–§10)
#   DRY_RUN=1 ...                                            # everything except the push
#
# One script rather than two on purpose: the build → sync → commit → push logic is identical and
# only the four names below differ, so keeping it in one place is what stops the two decks drifting
# apart in how they are published.
#
# Defaults, per deck:
#   storybook      DEPLOY_DIR ~/jayshankar-ui-deploy      PAGES_BASE /Jayshankar-ui/      remote Sairampv98/Jayshankar-ui
#   storybook-ant  DEPLOY_DIR ~/jayshankar-ui-antd-deploy PAGES_BASE /Jayshankar-ui-antd/ remote Sairampv98/Jayshankar-ui-antd
#   storybook-run  DEPLOY_DIR ~/jayshankar-ui-run-deploy  PAGES_BASE /Jayshankar-ui-run/  remote Sairampv98/Jayshankar-ui-run
#
# Override any of them (or DEPLOY_REMOTE) in the environment as before. PAGES_BASE must match the
# repository name EXACTLY — it is the URL path.
#
# The push needs your GitHub credentials. There are none in this environment, so it will stop with
# "could not read Username" unless you are running it yourself with a credential helper or you have
# authenticated once (git config --global credential.helper store, or a PAT).

set -euo pipefail
cd "$(dirname "$0")/.."

DECK=${DECK:-storybook}
case "$DECK" in
  storybook)
    DECK_DEFAULT_DIR=$HOME/jayshankar-ui-deploy
    DECK_DEFAULT_BASE=/Jayshankar-ui/
    DECK_DEFAULT_REMOTE=https://github.com/Sairampv98/Jayshankar-ui.git
    DECK_TITLE='the picture book'
    ;;
  storybook-ant)
    DECK_DEFAULT_DIR=$HOME/jayshankar-ui-antd-deploy
    DECK_DEFAULT_BASE=/Jayshankar-ui-antd/
    DECK_DEFAULT_REMOTE=https://github.com/Sairampv98/Jayshankar-ui-antd.git
    DECK_TITLE='the Ant Design deck'
    ;;
  storybook-run)
    DECK_DEFAULT_DIR=$HOME/jayshankar-ui-run-deploy
    DECK_DEFAULT_BASE=/Jayshankar-ui-run/
    DECK_DEFAULT_REMOTE=https://github.com/Sairampv98/Jayshankar-ui-run.git
    DECK_TITLE='"The Run" deck'
    ;;
  *)
    echo "! DECK must be 'storybook', 'storybook-ant' or 'storybook-run' (got '$DECK')" >&2
    exit 1
    ;;
esac

DEPLOY_DIR=${DEPLOY_DIR:-$DECK_DEFAULT_DIR}
PAGES_BASE=${PAGES_BASE:-$DECK_DEFAULT_BASE}
DEPLOY_REMOTE=${DEPLOY_REMOTE:-$DECK_DEFAULT_REMOTE}

# `build:storybook` / `build:storybook-ant` both rename their built entry to index.html themselves.
BUILD_SCRIPT="build:$DECK"
OUT_DIR="dist-$DECK"

echo "▸ building $DECK_TITLE for $PAGES_BASE"
VITE_BASE="$PAGES_BASE" npm run "$BUILD_SCRIPT"

echo "▸ syncing into $DEPLOY_DIR"
if [ ! -d "$DEPLOY_DIR/.git" ]; then
  echo "  ! $DEPLOY_DIR is not a git clone of the deploy repo." >&2
  echo "    Clone it first:  git clone $DEPLOY_REMOTE $DEPLOY_DIR" >&2
  exit 1
fi
# Replace the published site, keeping the repo's .git and its README.
find "$DEPLOY_DIR" -mindepth 1 -maxdepth 1 ! -name '.git' ! -name 'README.md' -exec rm -rf {} +
cp -a "$OUT_DIR"/. "$DEPLOY_DIR"/
# GitHub Pages runs Jekyll over a branch deploy unless this file exists; Jekyll skips files it
# does not understand, which would strip parts of the site.
touch "$DEPLOY_DIR/.nojekyll"

cd "$DEPLOY_DIR"
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git -c user.name='Sairampv98' -c user.email='97302336+Sairampv98@users.noreply.github.com' \
      commit -q -m "Update the review deck ($DECK)"
  echo "▸ committed $(git rev-parse --short HEAD)"
else
  echo "▸ build is identical to what is published — nothing to commit"
fi

if [ -n "${DRY_RUN:-}" ]; then
  echo "▸ DRY_RUN set — push skipped. To publish: git -C $DEPLOY_DIR push origin main"
  exit 0
fi

echo "▸ pushing to $DEPLOY_REMOTE"
git push origin main
echo "▸ live at https://sairampv98.github.io${PAGES_BASE}"
