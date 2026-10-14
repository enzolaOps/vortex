#!/usr/bin/env bash
set -euo pipefail

: "${GH_TOKEN:?GitHub App token is required}"
: "${JEV_API_KEY:?Configure the JEV_API_KEY Actions secret before enabling automated releases}"
: "${REPOSITORY:?REPOSITORY is required}"

OWNER="${REPOSITORY%%/*}"
REPO="${REPOSITORY#*/}"
STABILIZATION_SECONDS=90
MIN_CONFIDENCE=0.70
MAX_PRS=50
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

queue_size() {
  gh api graphql \
    -f query='query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        mergeQueue(branch: "main") {
          entries(first: 100) {
            totalCount
            nodes { id position }
          }
        }
      }
    }' \
    -F owner="$OWNER" -F name="$REPO" \
    --jq '.data.repository.mergeQueue.entries.totalCount'
}

echo "Checking merge queue for $OWNER/$REPO..."
before="$(queue_size)"
if [[ "$before" != "0" ]]; then
  echo "Queue has $before entr(y/ies); no release."
  exit 0
fi

echo "Queue is empty. Waiting ${STABILIZATION_SECONDS}s for late enqueues..."
sleep "$STABILIZATION_SECONDS"

after="$(queue_size)"
if [[ "$after" != "0" ]]; then
  echo "Queue now has $after entr(y/ies); no release."
  exit 0
fi

git fetch --force origin main --tags
MAIN_SHA="$(git rev-parse origin/main)"
MARKER_TAG="release-state/processed/$MAIN_SHA"
if [[ "${FORCE_REANALYZE:-false}" != "true" ]] && git show-ref --verify --quiet "refs/tags/$MARKER_TAG"; then
  echo "Main commit $MAIN_SHA was already analyzed; no repeated classification."
  exit 0
fi

mark_processed() {
  if ! git show-ref --verify --quiet "refs/tags/$MARKER_TAG"; then
    gh api --method POST "repos/$REPOSITORY/git/refs" \
      -f "ref=refs/tags/$MARKER_TAG" -f "sha=$MAIN_SHA" >/dev/null
  fi
}

needs_review() {
  message="$1"
  echo "::warning::$message"
  {
    echo "### Intelligent release paused for manual review"
    echo
    echo "$message"
    echo
    echo "No release was published. Review the PR metadata and rerun this workflow with force=true when ready."
  } >> "$GITHUB_STEP_SUMMARY"
  mark_processed
  exit 0
}
if [[ "$MAIN_SHA" != "$(git rev-parse HEAD)" ]]; then
  echo "Checkout is not at the latest main commit; aborting safely."
  exit 1
fi

LAST_TAG="$(git tag -l 'v[0-9]*' --sort=-version:refname | head -n 1)"
if [[ -z "$LAST_TAG" ]]; then
  echo "::error::No existing vX.Y.Z tag found; establish the initial release baseline manually."
  exit 1
fi
if ! [[ "$LAST_TAG" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  echo "::error::Latest version tag '$LAST_TAG' is not strict SemVer vX.Y.Z."
  exit 1
fi
MAJOR="${BASH_REMATCH[1]}"
MINOR="${BASH_REMATCH[2]}"
PATCH="${BASH_REMATCH[3]}"
TAG_DATE="$(git show -s --format=%cs "$LAST_TAG")"

echo "Last release tag: $LAST_TAG ($TAG_DATE); main: $MAIN_SHA"

# Search by date, then use commit ancestry to exclude PRs already covered by
# the tag. The date search is intentionally inclusive because GitHub search
# filters are day-granular.
gh pr list --state merged --base main \
  --search "merged:>=$TAG_DATE" --limit 1000 \
  --json number,title,body,mergedAt,url,labels,files,mergeCommit > "$TMP/pulls.json"

pull_count="$(jq 'length' "$TMP/pulls.json")"
if (( pull_count >= 1000 )); then
  echo "::error::PR search reached its 1000-result limit; refusing a potentially incomplete release."
  exit 1
fi

jq -c '[.[] | select(.mergeCommit.oid != null)]' "$TMP/pulls.json" > "$TMP/candidates.json"
: > "$TMP/eligible.jsonl"
while IFS= read -r pr; do
  sha="$(jq -r '.mergeCommit.oid' <<< "$pr")"
  if git merge-base --is-ancestor "$LAST_TAG" "$sha" &&
     git merge-base --is-ancestor "$sha" "$MAIN_SHA"; then
    printf '%s\n' "$pr" >> "$TMP/eligible.jsonl"
  fi
done < <(jq -c '.[]' "$TMP/candidates.json")

eligible_count="$(wc -l < "$TMP/eligible.jsonl" | tr -d ' ')"
if (( eligible_count == 0 )); then
  echo "No merged PRs after $LAST_TAG; no release."
  mark_processed
  exit 0
fi
if (( eligible_count > MAX_PRS )); then
  echo "::error::Found $eligible_count unreleased PRs (limit $MAX_PRS); refusing to classify an unexpectedly large batch."
  exit 1
fi

echo "Classifying $eligible_count merged PR(s) with Jev..."
major_count=0
minor_count=0
patch_count=0
none_count=0
: > "$TMP/major.md"
: > "$TMP/minor.md"
: > "$TMP/patch.md"
: > "$TMP/decisions.jsonl"

while IFS= read -r pr; do
  number="$(jq -r '.number' <<< "$pr")"
  title="$(jq -r '.title' <<< "$pr")"
  body="$(jq -r '.body // ""' <<< "$pr")"
  url="$(jq -r '.url' <<< "$pr")"
  labels="$(jq -c '[.labels[].name]' <<< "$pr")"
  files="$(jq -c '[.files[].path]' <<< "$pr")"

  jq -n \
    --argjson number "$number" \
    --arg title "$title" \
    --arg body "$body" \
    --arg url "$url" \
    --argjson labels "$labels" \
    --argjson files "$files" \
    '{number:$number,title:$title,body:$body,url:$url,labels:$labels,changed_files:$files}' \
    > "$TMP/pr-$number.json"

  result="$(jev ask --preset release-impact --param "pr=@$TMP/pr-$number.json")"
  choice="$(jq -er '.answers.impact.choice' <<< "$result")"
  confidence="$(jq -er --arg choice "$choice" '.answers.impact.probabilities[$choice]' <<< "$result")"

  if ! [[ "$confidence" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
    echo "::error::Jev returned no valid probability for PR #$number; refusing to publish."
    exit 1
  fi
  if awk -v p="$confidence" -v min="$MIN_CONFIDENCE" 'BEGIN { exit !(p >= min) }'; then
    :
  else
    needs_review "Jev confidence $confidence for PR #$number is below $MIN_CONFIDENCE; manual review required."
  fi
  if [[ "$choice" == "review" ]]; then
    needs_review "Jev marked PR #$number for manual review; no release will be published."
  fi

  printf '{"number":%s,"title":%s,"url":%s,"impact":%s,"probability":%s}\n' \
    "$number" "$(jq -Rn --arg v "$title" '$v')" "$(jq -Rn --arg v "$url" '$v')" \
    "$(jq -Rn --arg v "$choice" '$v')" "$confidence" >> "$TMP/decisions.jsonl"

  item="- **#$number** $title ([PR](<$url>))"
  case "$choice" in
    major) printf '%s\n' "$item" >> "$TMP/major.md"; ((major_count+=1)) ;;
    minor) printf '%s\n' "$item" >> "$TMP/minor.md"; ((minor_count+=1)) ;;
    patch) printf '%s\n' "$item" >> "$TMP/patch.md"; ((patch_count+=1)) ;;
    none) ((none_count+=1)) ;;
    *) echo "::error::Unexpected Jev label '$choice' for PR #$number."; exit 1 ;;
  esac
  echo "PR #$number => $choice (p=$confidence)"
done < "$TMP/eligible.jsonl"

if (( major_count + minor_count + patch_count == 0 )); then
  {
    echo "### Intelligent release"
    echo
    echo "No release created: all $none_count merged PR(s) were classified as having no meaningful user-facing impact."
    echo "Baseline: $LAST_TAG"
    echo "Commit: $MAIN_SHA"
  } >> "$GITHUB_STEP_SUMMARY"
  mark_processed
  exit 0
fi

if (( major_count > 0 )); then
  NEXT_TAG="v$((MAJOR + 1)).0.0"
elif (( minor_count > 0 )); then
  NEXT_TAG="v$MAJOR.$((MINOR + 1)).0"
else
  NEXT_TAG="v$MAJOR.$MINOR.$((PATCH + 1))"
fi

if gh release view "$NEXT_TAG" --repo "$REPOSITORY" >/dev/null 2>&1; then
  echo "::error::Release $NEXT_TAG already exists; refusing to create a duplicate."
  exit 1
fi

{
  echo "<!-- vortex-intelligent-release -->"
  echo
  echo "## Vortex $NEXT_TAG"
  echo
  echo "Changes since `$LAST_TAG`."
  if (( major_count > 0 )); then
    echo
    echo "### Breaking changes"
    echo
    cat "$TMP/major.md"
  fi
  if (( minor_count > 0 )); then
    echo
    echo "### Features"
    echo
    cat "$TMP/minor.md"
  fi
  if (( patch_count > 0 )); then
    echo
    echo "### Fixes and improvements"
    echo
    cat "$TMP/patch.md"
  fi
  if (( none_count > 0 )); then
    echo
    echo "<details><summary>Internal changes ($none_count)</summary>"
    echo
    jq -r 'select(.impact == "none") | "- **#\(.number)** \(.title) ([PR](<\(.url)>))"' "$TMP/decisions.jsonl"
    echo
    echo "</details>"
  fi
} > "$TMP/notes.md"

# Final race check: the queue and main must still match the state classified.
final_queue="$(queue_size)"
final_main="$(git ls-remote origin refs/heads/main | awk '{print $1}')"
if [[ "$final_queue" != "0" || "$final_main" != "$MAIN_SHA" ]]; then
  echo "Queue or main changed during classification; aborting. A later push/schedule will retry."
  exit 0
fi

echo "Publishing $NEXT_TAG for $MAIN_SHA..."
gh release create "$NEXT_TAG" \
  --repo "$REPOSITORY" \
  --target "$MAIN_SHA" \
  --title "$NEXT_TAG" \
  --notes-file "$TMP/notes.md"

{
  echo "### Intelligent release published"
  echo
  echo "- Release: https://github.com/$REPOSITORY/releases/tag/$NEXT_TAG"
  echo "- Previous tag: $LAST_TAG"
  echo "- Commit: $MAIN_SHA"
  echo "- PRs classified: $eligible_count"
  echo "- Major: $major_count; minor: $minor_count; patch: $patch_count; no release impact: $none_count"
  echo
  echo "#### Classifier decisions"
  jq -r '"- #\(.number) \(.title): \(.impact) (p=\(.probability))"' "$TMP/decisions.jsonl"
} >> "$GITHUB_STEP_SUMMARY"
